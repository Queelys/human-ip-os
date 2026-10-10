/**
 * C002.2 trefoil geometry. All checks here are NUMERICAL verifications of the
 * implementation; the topological statements they support are proven
 * analytically in docs/MI_MATH_RULES.md, not by these tests.
 */
import {describe, expect, it} from 'vitest';
import {CORE_GEOMETRY_PARAMS, createCoreGeometry} from '../src/core/geometry';
import {MI_IDENTITY} from '../src/core/identity';
import {geometryReport, NUMERIC_TOLERANCE} from '../src/identity/invariants';
import {DEFAULT_MI_SPEC} from '../src/identity/miKernel';
import {
	analyzeSampling,
	closureGap,
	knotDerivative,
	knotMinSpeedBound,
	knotPoint,
	knotSecondDerivative,
	sampleUniformParameter,
	wrapParam,
} from '../src/geometry/trefoil';
import {distance, length, sub, type Vec3} from '../src/geometry/vec3';

const K = DEFAULT_MI_SPEC.knot;

const numericDerivative = (f: (s: number) => Vec3, s: number, h = 1e-6): Vec3 => {
	const a = f(s + h);
	const b = f(s - h);
	return [(a[0] - b[0]) / (2 * h), (a[1] - b[1]) / (2 * h), (a[2] - b[2]) / (2 * h)];
};

describe('C002.2 curve closure and tangent continuity', () => {
	it('is closed: |K(1) − K(0)| ≈ 0', () => {
		expect(closureGap(K)).toBeLessThan(NUMERIC_TOLERANCE.closure);
	});

	it('tangent is continuous across the seam: K′(1) = K′(0), K″(1) = K″(0)', () => {
		expect(distance(knotDerivative(K, 1), knotDerivative(K, 0))).toBeLessThan(NUMERIC_TOLERANCE.tangentContinuity);
		expect(distance(knotSecondDerivative(K, 1), knotSecondDerivative(K, 0))).toBeLessThan(1e-7);
		// Approaching the seam from both sides.
		const left = knotDerivative(K, 1 - 1e-9);
		const right = knotDerivative(K, 1e-9);
		expect(distance(left, right) / length(right)).toBeLessThan(1e-6);
	});

	it('is 1-periodic for arbitrary parameters', () => {
		for (const s of [-3.25, -0.5, 0.1, 0.77, 5.9]) {
			expect(distance(knotPoint(K, s), knotPoint(K, s + 1))).toBeLessThan(1e-11);
			expect(distance(knotPoint(K, s), knotPoint(K, wrapParam(s)))).toBeLessThan(1e-11);
		}
	});

	it('analytic first/second derivatives match finite differences', () => {
		for (let i = 0; i < 64; i++) {
			const s = (i + 0.37) / 64;
			const d1 = knotDerivative(K, s);
			const d2 = knotSecondDerivative(K, s);
			expect(distance(d1, numericDerivative((x) => knotPoint(K, x), s)) / length(d1)).toBeLessThan(1e-6);
			expect(distance(d2, numericDerivative((x) => knotDerivative(K, x), s)) / length(d2)).toBeLessThan(1e-5);
		}
	});

	it('is regular: min |K′| ≥ closed-form bound > 0', () => {
		const report = geometryReport(DEFAULT_MI_SPEC);
		expect(knotMinSpeedBound(K)).toBeGreaterThan(0);
		expect(report.minSpeed).toBeGreaterThanOrEqual(knotMinSpeedBound(K) * (1 - 1e-12));
	});
});

describe('C002.2 sampling geometry safety', () => {
	it.each([64, 256, 512, 1024])('uniform sampling n=%i is non-degenerate', (n) => {
		const r = analyzeSampling(K, n);
		expect(r.allFinite).toBe(true);
		expect(r.minSegment).toBeGreaterThan(0);
		// Uniform parameter sampling: segment lengths vary only with the speed ratio.
		expect(r.maxSegment / r.minSegment).toBeLessThan(2);
		// No two non-adjacent samples collapse together (numerical self-avoidance).
		expect(r.minNonAdjacentDistance).toBeGreaterThan(0.5 * r.maxSegment);
		expect(r.maxTurnAngle).toBeLessThan(Math.PI / 4);
	});

	it('records the strand separation of K (numerical, not a proof)', () => {
		const r = analyzeSampling(K, 1024, 64);
		// Smallest distance between points that are far apart along the curve.
		expect(r.minNonAdjacentDistance).toBeGreaterThan(0.5);
	});

	it('rejects degenerate sample counts', () => {
		expect(() => sampleUniformParameter(K, 2)).toThrow();
		expect(() => sampleUniformParameter(K, 10.5)).toThrow();
	});

	it('total curvature exceeds 4π (Fáry–Milnor necessary condition for a knot)', () => {
		const report = geometryReport(DEFAULT_MI_SPEC);
		expect(report.totalCurvature).toBeGreaterThan(4 * Math.PI);
	});
});

describe('C002.2 diagram check (numerical)', () => {
	/** Crossings of the xy-projection of a closed polyline, with signs. */
	const projectedCrossings = (pts: readonly Vec3[]) => {
		const n = pts.length;
		const signs: number[] = [];
		for (let i = 0; i < n; i++) {
			const a0 = pts[i];
			const a1 = pts[(i + 1) % n];
			for (let j = i + 2; j < n; j++) {
				if (i === 0 && j === n - 1) continue;
				const b0 = pts[j];
				const b1 = pts[(j + 1) % n];
				const da = sub(a1, a0);
				const db = sub(b1, b0);
				const den = da[0] * db[1] - da[1] * db[0];
				if (Math.abs(den) < 1e-15) continue;
				const t = ((b0[0] - a0[0]) * db[1] - (b0[1] - a0[1]) * db[0]) / den;
				const u = ((b0[0] - a0[0]) * da[1] - (b0[1] - a0[1]) * da[0]) / den;
				if (t < 0 || t >= 1 || u < 0 || u >= 1) continue;
				const za = a0[2] + t * da[2];
				const zb = b0[2] + u * db[2];
				const [over, under] = za > zb ? [da, db] : [db, da];
				signs.push(Math.sign(over[0] * under[1] - over[1] * under[0]));
			}
		}
		return signs;
	};

	it('xy-projection has exactly 3 crossings of equal sign (trefoil diagram, fixed chirality)', () => {
		// Analytically the crossings sit at θ = π/6 + kπ/3 (cos 3θ = 0). Uniform
		// samples s = i/n can land exactly on one (e.g. s = 1/4), where a
		// segment-intersection test is ill-conditioned, so sample in generic
		// position with an irrational parameter offset.
		const n = 2000;
		const offset = (Math.SQRT2 - 1) / n;
		const signs = projectedCrossings(Array.from({length: n}, (_, i) => knotPoint(K, i / n + offset)));
		expect(signs.length).toBe(3);
		expect(new Set(signs).size).toBe(1);
		// Lock the chirality code so a mirror-image change is caught.
		expect(signs[0]).toMatchInlineSnapshot(`-1`);
	});
});

describe('C001 ↔ C002 consistency', () => {
	it('C001 mesh centre line is exactly K', () => {
		expect(CORE_GEOMETRY_PARAMS.radius).toBe(K.majorRadius);
		expect(K.minorRadius).toBe(K.majorRadius / 2);
		const geo = createCoreGeometry(MI_IDENTITY);
		const pos = geo.getAttribute('position');
		const {tubularSegments, radialSegments} = CORE_GEOMETRY_PARAMS;
		for (let i = 0; i <= tubularSegments; i += 16) {
			let cx = 0;
			let cy = 0;
			let cz = 0;
			for (let j = 0; j < radialSegments; j++) {
				const idx = i * (radialSegments + 1) + j;
				cx += pos.getX(idx);
				cy += pos.getY(idx);
				cz += pos.getZ(idx);
			}
			const centre: Vec3 = [cx / radialSegments, cy / radialSegments, cz / radialSegments];
			expect(distance(centre, knotPoint(K, i / tubularSegments))).toBeLessThan(1e-5);
		}
	});
});
