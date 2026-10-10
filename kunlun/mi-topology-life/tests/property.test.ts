/**
 * Property tests (C002.8). Each property samples legal inputs from a seeded
 * RNG; every case seed, input and failure is logged to
 * out/test-logs/property/<name>.json. See tests/support/property.ts.
 */
import {describe, expect, it} from 'vitest';
import {anchorStates} from '../src/identity/anchors';
import {validateSpec} from '../src/identity/invariants';
import {DEFAULT_MI_SPEC, type MiIdentitySpec} from '../src/identity/miKernel';
import {analyzeSampling, closureGap, knotMinSpeedBound} from '../src/geometry/trefoil';
import {distance, length, type Vec3} from '../src/geometry/vec3';
import {
	applyDeformation,
	type Deformation,
	type DeformationParams,
	deformationFromParams,
	invertDeformation,
	jacobianDeterminant,
	motionParamsAt,
	type Primitive,
	quatNormalize,
	rotation,
	uniformScale,
	validateDeformationParams,
	zTwist,
} from '../src/motion/deformation';
import {pulsePhase} from '../src/motion/pulse';
import {assertProperty, runProperty, type Rng, uniform} from './support/property';

const spec = DEFAULT_MI_SPEC;
const RUNS = 500;

const randomPoint = (rng: Rng, r = 4): Vec3 => [uniform(rng, -r, r), uniform(rng, -r, r), uniform(rng, -r, r)];

const legalParams = (rng: Rng): DeformationParams => ({
	yaw: uniform(rng, -Math.PI, Math.PI) * 4,
	pitch: uniform(rng, -Math.PI, Math.PI) * 4,
	roll: uniform(rng, -Math.PI, Math.PI) * 4,
	scale: uniform(rng, spec.deformation.scale.min, spec.deformation.scale.max),
	twist: uniform(rng, -1, 1) * spec.deformation.twistRateMax,
});

const randomPrimitive = (rng: Rng): Primitive => {
	const k = Math.floor(rng() * 3);
	if (k === 0) return rotation(quatNormalize([rng() - 0.5, rng() - 0.5, rng() - 0.5, rng() - 0.5]));
	// Positive scales across 4 orders of magnitude: always > 0 by construction.
	if (k === 1) return uniformScale(10 ** uniform(rng, -2, 2));
	return zTwist(uniform(rng, -10, 10));
};

/** Relative round-trip error, normalised by the size of the point. */
const relRoundTrip = (d: Deformation, v: Vec3) =>
	distance(applyDeformation(invertDeformation(d), applyDeformation(d, v)), v) / Math.max(1, length(v));

describe('C002.8 property tests', () => {
	it('legal-params: sampled Φ params validate and have scale > 0', () => {
		assertProperty('legal-params', {
			runs: RUNS,
			generate: legalParams,
			property: (p) => {
				expect(p.scale).toBeGreaterThan(0);
				expect(validateDeformationParams(spec, p).errors).toEqual([]);
			},
		});
	});

	it('inverse-identity: Φ⁻¹∘Φ ≈ id and Φ∘Φ⁻¹ ≈ id for legal params', () => {
		assertProperty('inverse-identity', {
			runs: RUNS,
			generate: (rng) => ({params: legalParams(rng), points: Array.from({length: 8}, () => randomPoint(rng))}),
			property: ({params, points}) => {
				const d = deformationFromParams(spec, params);
				const inv = invertDeformation(d);
				for (const v of points) {
					expect(relRoundTrip(d, v)).toBeLessThan(1e-9);
					expect(distance(applyDeformation(d, applyDeformation(inv, v)), v) / Math.max(1, length(v))).toBeLessThan(1e-9);
				}
			},
		});
	});

	it('inverse-identity-compositions: random chains of 1–8 primitives', () => {
		assertProperty('inverse-identity-compositions', {
			runs: RUNS,
			generate: (rng) => ({
				steps: Array.from({length: 1 + Math.floor(rng() * 8)}, () => randomPrimitive(rng)),
				point: randomPoint(rng, 2),
			}),
			property: ({steps, point}) => {
				const d = {steps};
				for (const p of steps) if (p.kind === 'scale') expect(p.s).toBeGreaterThan(0);
				// Error grows with the product of scale factors; normalise by it.
				const gain = steps.reduce((g, p) => (p.kind === 'scale' ? g * Math.max(p.s, 1 / p.s) : g), 1);
				expect(relRoundTrip(d, point) / gain).toBeLessThan(1e-9);
			},
		});
	});

	it('orientation: Jacobian det > 0 for legal Φ (chirality preserved)', () => {
		assertProperty('orientation', {
			runs: RUNS,
			generate: (rng) => ({params: legalParams(rng), point: randomPoint(rng, 2)}),
			property: ({params, point}) => {
				const j = jacobianDeterminant(deformationFromParams(spec, params), point);
				expect(j).toBeGreaterThan(0);
				expect(Math.abs(j / params.scale ** 3 - 1)).toBeLessThan(1e-5);
			},
		});
	});

	it('anchor-recovery: Φ⁻¹(anchor world) = K(s) for legal Φ', () => {
		assertProperty('anchor-recovery', {
			runs: RUNS,
			generate: legalParams,
			property: (params) => {
				const d = deformationFromParams(spec, params);
				const inv = invertDeformation(d);
				for (const a of anchorStates(spec, d)) {
					expect(distance(applyDeformation(inv, a.world), a.local)).toBeLessThan(1e-9);
				}
			},
		});
	});

	it('motion-time: any global time gives legal params with scale > 0', () => {
		assertProperty('motion-time', {
			runs: RUNS,
			generate: (rng) => ({t: uniform(rng, -1e4, 1e4)}),
			property: ({t}) => {
				const p = motionParamsAt(spec, t);
				expect(p.scale).toBeGreaterThan(0);
				expect(validateDeformationParams(spec, p).errors).toEqual([]);
				expect(motionParamsAt(spec, t)).toEqual(p);
			},
		});
	});

	it('pulse-phase: phase differences equal the spec offsets at any time', () => {
		assertProperty('pulse-phase', {
			runs: RUNS,
			generate: (rng) => ({t: uniform(rng, -1e3, 1e3)}),
			property: ({t}) => {
				const ph = (['A1', 'A2', 'A3'] as const).map((id) => pulsePhase(spec, id, t));
				for (let i = 1; i < 3; i++) {
					const d = ph[0] - ph[i] - spec.pulse.phaseOffsets[i];
					const wrapped = Math.abs(d - Math.round(d));
					expect(wrapped).toBeLessThan(1e-9);
				}
			},
		});
	});

	it('knot-geometry: legal radii give a closed, regular, non-degenerate sampled curve', () => {
		assertProperty('knot-geometry', {
			runs: 200,
			generate: (rng) => {
				const R = uniform(rng, 0.2, 5);
				return {majorRadius: R, minorRadius: R * uniform(rng, 0.05, 0.95)};
			},
			property: (radii) => {
				const s: MiIdentitySpec = {...spec, knot: {...spec.knot, ...radii}};
				expect(validateSpec(s).errors).toEqual([]);
				expect(closureGap(s.knot)).toBeLessThan(1e-9 * radii.majorRadius);
				expect(knotMinSpeedBound(s.knot)).toBeGreaterThan(0);
				const r = analyzeSampling(s.knot, 256);
				expect(r.allFinite).toBe(true);
				expect(r.minSegment).toBeGreaterThan(0);
				expect(r.minNonAdjacentDistance).toBeGreaterThan(0);
			},
		});
	});

	it('harness: failures are recorded with seeds and reproduce exactly via MI_PROPERTY_SEED', () => {
		// Deliberately failing property; its report is named so it cannot be
		// mistaken for a real failure.
		const failing = {
			runs: 50,
			generate: (rng: Rng) => ({x: rng()}),
			property: ({x}: {x: number}) => (x < 0.2 ? `x=${x} < 0.2` : undefined),
		};
		const report = runProperty('_selftest-expected-failures', failing);
		expect(report.failures.length).toBeGreaterThan(0);
		const f = report.failures[0];

		const prev = process.env.MI_PROPERTY_SEED;
		process.env.MI_PROPERTY_SEED = String(f.caseSeed);
		try {
			const replay = runProperty('_selftest-replay', {...failing, writeReport: false});
			expect(replay.runs).toBe(1);
			expect(replay.failures[0].input).toEqual(f.input);
			expect(replay.failures[0].error).toBe(f.error);
		} finally {
			if (prev === undefined) delete process.env.MI_PROPERTY_SEED;
			else process.env.MI_PROPERTY_SEED = prev;
		}
	});
});
