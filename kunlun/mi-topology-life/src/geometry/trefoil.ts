/**
 * K — Mi's core closed curve: the (p, q) = (2, 3) torus knot (trefoil).
 *
 * Parametrisation on the unit parameter s ∈ [0, 1), θ = 2πs:
 *
 *   K(s) = ( (R + a·cos qθ)·cos pθ,  (R + a·cos qθ)·sin pθ,  a·sin qθ )
 *
 * This is exactly the centre line of Three.js' TorusKnotGeometry(radius = R)
 * with a = R/2, so the C001 test mesh and the C002 kernel share one curve
 * (locked by tests/trefoil.test.ts).
 *
 * Analytic facts (see docs/MI_MATH_RULES.md):
 *  - K is 1-periodic and C^∞, so it is closed with continuous tangent.
 *  - |dK/dθ|² = a²q² + p²(R + a·cos qθ)² ≥ a²q² > 0, so K is regular.
 *  - For gcd(p, q) = 1, p, q ≥ 2 and R > a > 0, K is an embedded torus knot
 *    T(p, q); T(2, 3) is the trefoil.
 */
import {cross, dot, length, type Vec3, sub, distance} from './vec3';

export type TorusKnotParams = {
	readonly p: number;
	readonly q: number;
	/** Major radius R (distance of the torus tube centre from the z axis). */
	readonly majorRadius: number;
	/** Minor radius a (tube radius of the carrier torus); must satisfy 0 < a < R. */
	readonly minorRadius: number;
};

const TAU = Math.PI * 2;

/** Wrap any real parameter into [0, 1). */
export const wrapParam = (s: number): number => {
	const w = s - Math.floor(s);
	return w === 1 ? 0 : w;
};

/** K(s). */
export const knotPoint = (k: TorusKnotParams, s: number): Vec3 => {
	const t = TAU * s;
	const ring = k.majorRadius + k.minorRadius * Math.cos(k.q * t);
	return [ring * Math.cos(k.p * t), ring * Math.sin(k.p * t), k.minorRadius * Math.sin(k.q * t)];
};

/** dK/ds (analytic). */
export const knotDerivative = (k: TorusKnotParams, s: number): Vec3 => {
	const t = TAU * s;
	const {p, q, majorRadius: R, minorRadius: a} = k;
	const ring = R + a * Math.cos(q * t);
	const dRing = -a * q * Math.sin(q * t);
	return [
		TAU * (dRing * Math.cos(p * t) - ring * p * Math.sin(p * t)),
		TAU * (dRing * Math.sin(p * t) + ring * p * Math.cos(p * t)),
		TAU * (a * q * Math.cos(q * t)),
	];
};

/** d²K/ds² (analytic). */
export const knotSecondDerivative = (k: TorusKnotParams, s: number): Vec3 => {
	const t = TAU * s;
	const {p, q, majorRadius: R, minorRadius: a} = k;
	const ring = R + a * Math.cos(q * t);
	const dRing = -a * q * Math.sin(q * t);
	const ddRing = -a * q * q * Math.cos(q * t);
	const cp = Math.cos(p * t);
	const sp = Math.sin(p * t);
	const T2 = TAU * TAU;
	return [
		T2 * (ddRing * cp - 2 * dRing * p * sp - ring * p * p * cp),
		T2 * (ddRing * sp + 2 * dRing * p * cp - ring * p * p * sp),
		T2 * (-a * q * q * Math.sin(q * t)),
	];
};

/** Closed-form lower bound of the speed |dK/ds| = 2π·sqrt(a²q² + p²(R + a cos qθ)²). */
export const knotMinSpeedBound = (k: TorusKnotParams): number =>
	TAU * Math.hypot(k.minorRadius * k.q, k.p * (k.majorRadius - k.minorRadius));

/** Curvature κ(s) = |K' × K''| / |K'|³. */
export const knotCurvature = (k: TorusKnotParams, s: number): number => {
	const d1 = knotDerivative(k, s);
	const d2 = knotSecondDerivative(k, s);
	return length(cross(d1, d2)) / length(d1) ** 3;
};

/** Uniform parameter sampling: s_i = i / n, i = 0 … n−1 (the closing point is implicit). */
export const sampleUniformParameter = (k: TorusKnotParams, n: number): Vec3[] => {
	if (!Number.isInteger(n) || n < 3) {
		throw new Error(`sample count must be an integer ≥ 3, got ${n}`);
	}
	return Array.from({length: n}, (_, i) => knotPoint(k, i / n));
};

export type SamplingReport = {
	readonly n: number;
	readonly minSegment: number;
	readonly maxSegment: number;
	/** Smallest distance between samples that are more than `window` apart along the loop. */
	readonly minNonAdjacentDistance: number;
	readonly window: number;
	/** Largest angle (radians) between consecutive analytic tangents. */
	readonly maxTurnAngle: number;
	readonly allFinite: boolean;
};

/**
 * Numerical safety report for a uniform sampling. This is a *numerical*
 * check of the discretisation, not a topological proof.
 */
export const analyzeSampling = (k: TorusKnotParams, n: number, window = 4): SamplingReport => {
	const pts = sampleUniformParameter(k, n);
	let minSegment = Infinity;
	let maxSegment = 0;
	let maxTurnAngle = 0;
	let allFinite = true;
	for (let i = 0; i < n; i++) {
		const a = pts[i];
		const b = pts[(i + 1) % n];
		allFinite &&= a.every(Number.isFinite);
		const d = distance(a, b);
		minSegment = Math.min(minSegment, d);
		maxSegment = Math.max(maxSegment, d);
		const t0 = knotDerivative(k, i / n);
		const t1 = knotDerivative(k, (i + 1) / n);
		const cos = dot(t0, t1) / (length(t0) * length(t1));
		maxTurnAngle = Math.max(maxTurnAngle, Math.acos(Math.min(1, Math.max(-1, cos))));
	}
	let minNonAdjacentDistance = Infinity;
	for (let i = 0; i < n; i++) {
		for (let j = i + 1; j < n; j++) {
			const gap = Math.min(j - i, n - (j - i));
			if (gap > window) {
				minNonAdjacentDistance = Math.min(minNonAdjacentDistance, distance(pts[i], pts[j]));
			}
		}
	}
	return {n, minSegment, maxSegment, minNonAdjacentDistance, window, maxTurnAngle, allFinite};
};

/** Numerical total curvature ∫κ|K'|ds by the midpoint rule. */
export const totalCurvature = (k: TorusKnotParams, n = 4096): number => {
	let sum = 0;
	for (let i = 0; i < n; i++) {
		const s = (i + 0.5) / n;
		sum += knotCurvature(k, s) * length(knotDerivative(k, s));
	}
	return sum / n;
};

/** Gap between curve end and start, |K(1) − K(0)|. */
export const closureGap = (k: TorusKnotParams): number => length(sub(knotPoint(k, 1), knotPoint(k, 0)));
