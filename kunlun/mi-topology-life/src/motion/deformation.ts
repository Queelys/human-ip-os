/**
 * Φ — the constrained deformation engine.
 *
 * The only primitives are
 *   rotation  R ∈ SO(3)   (unit quaternion; reflections are unrepresentable)
 *   scale     x ↦ s·x, s > 0
 *   z-twist   (x, y, z) ↦ (Rot_z(k·z)·(x, y), z)
 * and finite compositions of them. Each primitive is a smooth,
 * orientation-preserving diffeomorphism of R³ with an exact closed-form
 * inverse, and lies in a continuous family through the identity — so every
 * Φ is an ambient isotopy and cannot change the knot type or chirality of K
 * (proof sketch: docs/MI_MATH_RULES.md). Arbitrary per-vertex displacement
 * is deliberately not offered here.
 */
import type {Vec3} from '../geometry/vec3';
import type {MiIdentitySpec} from '../identity/miKernel';

export type Quat = readonly [number, number, number, number]; // [x, y, z, w]

export type Primitive =
	| {readonly kind: 'rotation'; readonly q: Quat}
	| {readonly kind: 'scale'; readonly s: number}
	| {readonly kind: 'twist'; readonly k: number};

/** Applied left to right: steps[0] first. */
export type Deformation = {readonly steps: readonly Primitive[]};

export const IDENTITY_DEFORMATION: Deformation = Object.freeze({steps: Object.freeze([])});

// ── quaternions ────────────────────────────────────────────────────────────

export const quatNormalize = (q: Quat): Quat => {
	const n = Math.hypot(q[0], q[1], q[2], q[3]);
	if (!(n > 0) || !Number.isFinite(n)) {
		throw new Error('Rotation quaternion must be finite and non-zero');
	}
	return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
};

export const quatFromAxisAngle = (axis: Vec3, angle: number): Quat => {
	const n = Math.hypot(axis[0], axis[1], axis[2]);
	if (!(n > 0)) {
		throw new Error('Rotation axis must be non-zero');
	}
	const h = Math.sin(angle / 2) / n;
	return [axis[0] * h, axis[1] * h, axis[2] * h, Math.cos(angle / 2)];
};

export const quatMultiply = (a: Quat, b: Quat): Quat => [
	a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
	a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
	a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
	a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];

/** Intrinsic yaw (y) → pitch (x) → roll (z), radians. */
export const quatFromEuler = (yaw: number, pitch: number, roll: number): Quat =>
	quatMultiply(
		quatMultiply(quatFromAxisAngle([0, 1, 0], yaw), quatFromAxisAngle([1, 0, 0], pitch)),
		quatFromAxisAngle([0, 0, 1], roll),
	);

export const quatConjugate = (q: Quat): Quat => [-q[0], -q[1], -q[2], q[3]];

export const rotateVec = (q: Quat, v: Vec3): Vec3 => {
	const [x, y, z, w] = quatNormalize(q);
	// v' = v + 2w(u×v) + 2u×(u×v), u = (x, y, z)
	const tx = 2 * (y * v[2] - z * v[1]);
	const ty = 2 * (z * v[0] - x * v[2]);
	const tz = 2 * (x * v[1] - y * v[0]);
	return [
		v[0] + w * tx + (y * tz - z * ty),
		v[1] + w * ty + (z * tx - x * tz),
		v[2] + w * tz + (x * ty - y * tx),
	];
};

// ── primitives ─────────────────────────────────────────────────────────────

export const rotation = (q: Quat): Primitive => ({kind: 'rotation', q: quatNormalize(q)});

export const uniformScale = (s: number): Primitive => {
	if (!(s > 0) || !Number.isFinite(s)) {
		throw new Error(`Uniform scale must be finite and > 0, got ${s}`);
	}
	return {kind: 'scale', s};
};

export const zTwist = (k: number): Primitive => {
	if (!Number.isFinite(k)) {
		throw new Error(`Twist rate must be finite, got ${k}`);
	}
	return {kind: 'twist', k};
};

const applyPrimitive = (p: Primitive, v: Vec3): Vec3 => {
	switch (p.kind) {
		case 'rotation':
			return rotateVec(p.q, v);
		case 'scale':
			return [v[0] * p.s, v[1] * p.s, v[2] * p.s];
		case 'twist': {
			const ang = p.k * v[2];
			const c = Math.cos(ang);
			const s = Math.sin(ang);
			return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]];
		}
		default:
			throw new Error(`Forbidden deformation primitive: ${JSON.stringify(p)}`);
	}
};

const invertPrimitive = (p: Primitive): Primitive => {
	switch (p.kind) {
		case 'rotation':
			return {kind: 'rotation', q: quatConjugate(p.q)};
		case 'scale':
			return {kind: 'scale', s: 1 / p.s};
		case 'twist':
			return {kind: 'twist', k: -p.k};
		default:
			throw new Error(`Forbidden deformation primitive: ${JSON.stringify(p)}`);
	}
};

export const compose = (...ds: readonly Deformation[]): Deformation => ({
	steps: ds.flatMap((d) => d.steps),
});

export const applyDeformation = (d: Deformation, v: Vec3): Vec3 =>
	d.steps.reduce((acc, p) => applyPrimitive(p, acc), v);

/** Exact inverse: reverse order, invert each primitive. */
export const invertDeformation = (d: Deformation): Deformation => ({
	steps: [...d.steps].reverse().map(invertPrimitive),
});

/** Numerical Jacobian determinant at v (central differences). > 0 ⇔ orientation preserved locally. */
export const jacobianDeterminant = (d: Deformation, v: Vec3, h = 1e-5): number => {
	const col = (axis: 0 | 1 | 2): Vec3 => {
		const a: [number, number, number] = [...v];
		const b: [number, number, number] = [...v];
		a[axis] += h;
		b[axis] -= h;
		const fa = applyDeformation(d, a);
		const fb = applyDeformation(d, b);
		return [(fa[0] - fb[0]) / (2 * h), (fa[1] - fb[1]) / (2 * h), (fa[2] - fb[2]) / (2 * h)];
	};
	const c0 = col(0);
	const c1 = col(1);
	const c2 = col(2);
	return c0[0] * (c1[1] * c2[2] - c1[2] * c2[1]) - c1[0] * (c0[1] * c2[2] - c0[2] * c2[1]) + c2[0] * (c0[1] * c1[2] - c0[2] * c1[1]);
};

// ── user-facing parameters ────────────────────────────────────────────────

/** Serialisable deformation parameters (what the debugger sliders edit). */
export type DeformationParams = {
	readonly yaw: number;
	readonly pitch: number;
	readonly roll: number;
	readonly scale: number;
	/** Twist rate k in radians per unit z. */
	readonly twist: number;
};

export const DEFAULT_DEFORMATION_PARAMS: DeformationParams = Object.freeze({
	yaw: 0,
	pitch: 0,
	roll: 0,
	scale: 1,
	twist: 0,
});

/** Check params against the spec's Φ constraints. */
export const validateDeformationParams = (
	spec: MiIdentitySpec,
	p: DeformationParams,
): {readonly ok: boolean; readonly errors: readonly string[]} => {
	const errors: string[] = [];
	for (const [k, v] of Object.entries(p)) {
		if (!Number.isFinite(v)) errors.push(`${k} must be finite`);
	}
	const {min, max} = spec.deformation.scale;
	if (!(p.scale > 0)) errors.push(`scale must be > 0 (got ${p.scale})`);
	if (p.scale < min || p.scale > max) errors.push(`scale ${p.scale} outside [${min}, ${max}]`);
	if (Math.abs(p.twist) > spec.deformation.twistRateMax) {
		errors.push(`|twist| ${Math.abs(p.twist)} exceeds ${spec.deformation.twistRateMax}`);
	}
	return {ok: errors.length === 0, errors};
};

/** Φ(params) = R ∘ S ∘ T: twist in the body frame, then scale, then rotate. */
export const deformationFromParams = (spec: MiIdentitySpec, p: DeformationParams): Deformation => {
	const v = validateDeformationParams(spec, p);
	if (!v.ok) {
		throw new Error(`Deformation outside Φ constraints: ${v.errors.join('; ')}`);
	}
	return {
		steps: [zTwist(p.twist), uniformScale(p.scale), rotation(quatFromEuler(p.yaw, p.pitch, p.roll))],
	};
};

// ── global-time driven motion ─────────────────────────────────────────────

/** A time→params profile. Pure: depends only on t, never on previous frames. */
export type MotionProfile = {
	readonly yawPeriodSeconds: number;
	readonly pitchAmplitude: number;
	readonly pitchPeriodSeconds: number;
	readonly scaleAmplitude: number;
	readonly scalePeriodSeconds: number;
	/** Fraction of spec.deformation.twistRateMax used at peak, in [0, 1]. */
	readonly twistFraction: number;
	readonly twistPeriodSeconds: number;
};

export const DEFAULT_MOTION_PROFILE: MotionProfile = Object.freeze({
	yawPeriodSeconds: 12,
	pitchAmplitude: 0.25,
	pitchPeriodSeconds: 10,
	scaleAmplitude: 0.08,
	scalePeriodSeconds: 6,
	twistFraction: 0.6,
	twistPeriodSeconds: 10,
});

const TAU = Math.PI * 2;

export const motionParamsAt = (
	spec: MiIdentitySpec,
	timeSeconds: number,
	profile: MotionProfile = DEFAULT_MOTION_PROFILE,
): DeformationParams => {
	const t = timeSeconds;
	return {
		yaw: (TAU * t) / profile.yawPeriodSeconds,
		pitch: profile.pitchAmplitude * Math.sin((TAU * t) / profile.pitchPeriodSeconds),
		roll: 0,
		// amplitude < 1 keeps scale strictly positive for every t.
		scale: 1 + profile.scaleAmplitude * Math.sin((TAU * t) / profile.scalePeriodSeconds),
		twist:
			profile.twistFraction * spec.deformation.twistRateMax * Math.sin((TAU * t) / profile.twistPeriodSeconds),
	};
};

export const deformationAt = (
	spec: MiIdentitySpec,
	timeSeconds: number,
	profile: MotionProfile = DEFAULT_MOTION_PROFILE,
): Deformation => deformationFromParams(spec, motionParamsAt(spec, timeSeconds, profile));
