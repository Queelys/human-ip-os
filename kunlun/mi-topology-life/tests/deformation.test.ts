import {mkdirSync, writeFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {FILM, FILM_DURATION_IN_FRAMES} from '../src/config/film';
import {anchorStates} from '../src/identity/anchors';
import {NUMERIC_TOLERANCE} from '../src/identity/invariants';
import {DEFAULT_MI_SPEC} from '../src/identity/miKernel';
import {knotPoint, sampleUniformParameter} from '../src/geometry/trefoil';
import {det3, distance, length, type Vec3} from '../src/geometry/vec3';
import {
	applyDeformation,
	compose,
	type Deformation,
	DEFAULT_DEFORMATION_PARAMS,
	deformationAt,
	deformationFromParams,
	invertDeformation,
	jacobianDeterminant,
	motionParamsAt,
	type Primitive,
	quatFromAxisAngle,
	quatFromEuler,
	rotateVec,
	rotation,
	uniformScale,
	validateDeformationParams,
	zTwist,
} from '../src/motion/deformation';

const spec = DEFAULT_MI_SPEC;
const probe: Vec3[] = [[0, 0, 0], [1, 0, 0], [0.3, -2, 0.7], [-1.5, 0.4, -0.6], ...sampleUniformParameter(spec.knot, 64)];
const roundTripError = (d: Deformation, v: Vec3) => distance(applyDeformation(invertDeformation(d), applyDeformation(d, v)), v);
const one = (p: Primitive): Deformation => ({steps: [p]});

describe('C002.4 primitives', () => {
	it('SO(3) rotation: orthonormal columns, det = +1, inverse exact', () => {
		const q = quatFromEuler(0.7, -1.2, 2.3);
		const c0 = rotateVec(q, [1, 0, 0]);
		const c1 = rotateVec(q, [0, 1, 0]);
		const c2 = rotateVec(q, [0, 0, 1]);
		expect(det3(c0, c1, c2)).toBeCloseTo(1, 12);
		for (const c of [c0, c1, c2]) expect(length(c)).toBeCloseTo(1, 12);
		for (const v of probe) {
			expect(roundTripError(one(rotation(q)), v)).toBeLessThan(NUMERIC_TOLERANCE.inverse);
			expect(length(rotateVec(q, v))).toBeCloseTo(length(v), 12);
		}
	});

	it('rotation by π about z matches closed form', () => {
		const v = rotateVec(quatFromAxisAngle([0, 0, 1], Math.PI), [1, 2, 3]);
		expect(distance(v, [-1, -2, 3])).toBeLessThan(1e-12);
	});

	it('positive uniform scale: inverse exact, non-positive rejected', () => {
		for (const s of [0.25, 1, 2.75]) {
			for (const v of probe) expect(roundTripError(one(uniformScale(s)), v)).toBeLessThan(NUMERIC_TOLERANCE.inverse);
		}
		for (const bad of [0, -1, Number.NaN, Infinity]) expect(() => uniformScale(bad)).toThrow();
	});

	it('z-twist: preserves z and distance to the z axis, inverse exact', () => {
		const t = zTwist(1.3);
		for (const v of probe) {
			const w = applyDeformation(one(t), v);
			expect(w[2]).toBe(v[2]);
			expect(Math.hypot(w[0], w[1])).toBeCloseTo(Math.hypot(v[0], v[1]), 12);
			expect(roundTripError(one(t), v)).toBeLessThan(NUMERIC_TOLERANCE.inverse);
		}
		expect(() => zTwist(Number.NaN)).toThrow();
	});

	it('compositions: inverse is reverse-order composition of inverses', () => {
		const d = compose(one(zTwist(-0.9)), one(uniformScale(1.8)), one(rotation(quatFromEuler(1, 2, 3))), one(zTwist(0.4)));
		for (const v of probe) expect(roundTripError(d, v)).toBeLessThan(NUMERIC_TOLERANCE.inverse);
		// Also Φ ∘ Φ⁻¹ = id.
		for (const v of probe) {
			expect(distance(applyDeformation(d, applyDeformation(invertDeformation(d), v)), v)).toBeLessThan(NUMERIC_TOLERANCE.inverse);
		}
	});

	it('every allowed Φ is orientation-preserving (Jacobian det > 0, so no mirror trefoil)', () => {
		const d = deformationFromParams(spec, {yaw: 0.3, pitch: 1.1, roll: -2, scale: 2.2, twist: -1.4});
		for (const v of probe) {
			const j = jacobianDeterminant(d, v);
			// det = s³ for rotation·scale·twist (twist and rotation are volume-preserving).
			expect(j).toBeGreaterThan(0);
			expect(j).toBeCloseTo(2.2 ** 3, 5);
		}
	});

	it('forbidden primitives are rejected at runtime', () => {
		const bad = {steps: [{kind: 'vertex-noise', amount: 1}]} as unknown as Deformation;
		expect(() => applyDeformation(bad, [0, 0, 0])).toThrow(/Forbidden/);
		expect(() => invertDeformation(bad)).toThrow(/Forbidden/);
	});
});

describe('C002.4 Φ constraints from the spec', () => {
	it('defaults are the identity map', () => {
		const d = deformationFromParams(spec, DEFAULT_DEFORMATION_PARAMS);
		for (const v of probe) expect(distance(applyDeformation(d, v), v)).toBeLessThan(1e-12);
	});

	it.each([
		[{scale: 0}, /scale/],
		[{scale: -1}, /scale/],
		[{scale: 3.01}, /outside/],
		[{twist: 2}, /twist/],
		[{yaw: Number.NaN}, /finite/],
	])('rejects out-of-family params %o', (patch, msg) => {
		const p = {...DEFAULT_DEFORMATION_PARAMS, ...patch};
		expect(validateDeformationParams(spec, p).ok).toBe(false);
		expect(() => deformationFromParams(spec, p)).toThrow(msg);
	});
});

describe('C002.4 global-time driven deformation', () => {
	it('is a pure function of time (order independent, repeatable)', () => {
		const frames = [0, 899, 450, 1, 450, 0];
		const a = frames.map((f) => motionParamsAt(spec, f / FILM.fps));
		const b = [...frames].reverse().map((f) => motionParamsAt(spec, f / FILM.fps)).reverse();
		expect(a).toEqual(b);
		expect(a[0]).toEqual(a[5]);
	});

	it('stays inside Φ constraints on every film frame', () => {
		for (let f = 0; f < FILM_DURATION_IN_FRAMES; f++) {
			const p = motionParamsAt(spec, f / FILM.fps);
			expect(validateDeformationParams(spec, p).errors).toEqual([]);
			expect(p.scale).toBeGreaterThan(0);
		}
	});

	it('is continuous in time: small Δt ⇒ small displacement', () => {
		for (const t of [0, 3.3, 17.9, 29.96]) {
			const d0 = deformationAt(spec, t);
			const d1 = deformationAt(spec, t + 1e-6);
			for (const v of probe.slice(0, 8)) {
				expect(distance(applyDeformation(d0, v), applyDeformation(d1, v))).toBeLessThan(1e-4);
			}
		}
	});
});

describe('C002.3 anchors trackable in every test frame', () => {
	it('all 900 film frames: anchors finite, Φ(K(s)), invertible, distinct, ordered', () => {
		const log: unknown[] = [];
		let maxInverseError = 0;
		let minPairDistance = Infinity;
		for (let f = 0; f < FILM_DURATION_IN_FRAMES; f++) {
			const t = f / FILM.fps;
			const d = deformationAt(spec, t);
			const inv = invertDeformation(d);
			const states = anchorStates(spec, d);
			expect(states.map((a) => a.id)).toEqual(['A1', 'A2', 'A3']);
			for (const a of states) {
				expect(a.world.every(Number.isFinite)).toBe(true);
				// Identity is the parameter: world must equal Φ(K(s)) exactly.
				expect(a.world).toEqual(applyDeformation(d, knotPoint(spec.knot, a.s)));
				const err = distance(applyDeformation(inv, a.world), a.local);
				maxInverseError = Math.max(maxInverseError, err);
			}
			for (let i = 0; i < 3; i++) {
				minPairDistance = Math.min(minPairDistance, distance(states[i].world, states[(i + 1) % 3].world));
			}
			if (f % 150 === 0 || f === FILM_DURATION_IN_FRAMES - 1) {
				log.push({frame: f, params: motionParamsAt(spec, t), anchors: states.map((a) => ({id: a.id, world: a.world}))});
			}
		}
		expect(maxInverseError).toBeLessThan(NUMERIC_TOLERANCE.inverse);
		expect(minPairDistance).toBeGreaterThan(0.5);
		mkdirSync('out/test-logs', {recursive: true});
		writeFileSync(
			'out/test-logs/anchor-tracking.json',
			JSON.stringify({frames: FILM_DURATION_IN_FRAMES, maxInverseError, minPairDistance, keyframes: log}, null, 2),
		);
	});
});
