/**
 * C003.8 identity checks over all 900 film frames. Identity is verified
 * numerically against the C002 kernel — never by visual similarity.
 */
import {mkdirSync, writeFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {FILM_DURATION_IN_FRAMES} from '../../src/config/film';
import {arcRevealAt, FILM_SPEC, filmDeformationParams, filmStateAt} from '../../src/film/choreography';
import {CORE_TUBE_RADIUS, TUBE_RADIUS_TO_SEPARATION_MAX} from '../../src/film/visual';
import {knotPoint, sampleUniformParameter} from '../../src/geometry/trefoil';
import {distance, type Vec3} from '../../src/geometry/vec3';
import {anchorStates} from '../../src/identity/anchors';
import {validateSpec} from '../../src/identity/invariants';
import {DEFAULT_MI_SPEC, graphSignature, identityFingerprint, serializeSpec} from '../../src/identity/miKernel';
import {
	applyDeformation,
	invertDeformation,
	jacobianDeterminant,
	validateDeformationParams,
} from '../../src/motion/deformation';
import {pulseIntensity} from '../../src/motion/pulse';

const C002_FINGERPRINT = 'cd2e236379d37be5';
const FRAMES = Array.from({length: FILM_DURATION_IN_FRAMES}, (_, f) => f);
const states = FRAMES.map((f) => filmStateAt(f));

/** Recursively collect every number in a value; fail on NaN/±Infinity. */
const assertAllFinite = (v: unknown, path: string): void => {
	if (typeof v === 'number') {
		if (!Number.isFinite(v)) throw new Error(`non-finite ${v} at ${path}`);
	} else if (Array.isArray(v) || ArrayBuffer.isView(v)) {
		Array.from(v as ArrayLike<unknown>).forEach((x, i) => assertAllFinite(x, `${path}[${i}]`));
	} else if (v && typeof v === 'object') {
		for (const [k, x] of Object.entries(v)) assertAllFinite(x, `${path}.${k}`);
	}
};

/** Smallest distance between curve samples more than `window` apart along the loop. */
const minSeparation = (pts: readonly Vec3[], window: number): number => {
	const n = pts.length;
	let m = Infinity;
	for (let i = 0; i < n; i++) {
		for (let j = i + window + 1; j < n; j++) {
			if (n - (j - i) > window) m = Math.min(m, distance(pts[i], pts[j]));
		}
	}
	return m;
};

describe('C003.8 identity kernel is used, not copied or modified', () => {
	it('film uses the C002 spec object itself, unchanged', () => {
		expect(FILM_SPEC).toBe(DEFAULT_MI_SPEC);
		expect(identityFingerprint(FILM_SPEC)).toBe(C002_FINGERPRINT);
		expect(validateSpec(FILM_SPEC).ok).toBe(true);
		expect(Object.isFrozen(FILM_SPEC.anchors)).toBe(true);
	});

	it('computing the whole film leaves the spec byte-identical', () => {
		const before = serializeSpec(DEFAULT_MI_SPEC);
		const sig = graphSignature(DEFAULT_MI_SPEC);
		for (const f of FRAMES) filmStateAt(f);
		expect(serializeSpec(DEFAULT_MI_SPEC)).toBe(before);
		expect(graphSignature(DEFAULT_MI_SPEC)).toBe(sig);
		expect(identityFingerprint(DEFAULT_MI_SPEC)).toBe(C002_FINGERPRINT);
	});
});

describe('C003.8 anchors exist and keep identity on every frame', () => {
	it('three anchors A1–A3 with their spec parameters, positioned at Φ(K(s))', () => {
		const violations: string[] = [];
		for (const st of states) {
			if (st.anchors.map((a) => a.id).join() !== 'A1,A2,A3') violations.push(`frame ${st.frame}: ids`);
			const kernel = anchorStates(FILM_SPEC, st.deformation);
			st.anchors.forEach((a, i) => {
				const expected = applyDeformation(st.deformation, knotPoint(FILM_SPEC.knot, a.s));
				if (a.s !== FILM_SPEC.anchors[i].s) violations.push(`frame ${st.frame}: ${a.id}.s`);
				if (a.world.some((v, k) => v !== kernel[i].world[k] || v !== expected[k])) violations.push(`frame ${st.frame}: ${a.id}.world`);
			});
		}
		expect(violations).toEqual([]);
	});

	it('pulse values are the unmodified P protocol', () => {
		for (const st of states) {
			for (const a of st.anchors) expect(a.pulse).toBe(pulseIntensity(FILM_SPEC, a.id, st.time));
		}
	});

	it('ACT V: P gives the sequence A1 → A2 → A3 at 27 s, 28 s, 29 s; resonance is shared', () => {
		const peakFrame = (id: 'A1' | 'A2' | 'A3', from: number, to: number) => {
			let best = from;
			for (let f = from; f <= to; f++) if (states[f].anchors.find((a) => a.id === id)!.pulse > states[best].anchors.find((a) => a.id === id)!.pulse) best = f;
			return best;
		};
		const a1 = peakFrame('A1', 810, 899);
		const a2 = peakFrame('A2', 840, 899);
		const a3 = peakFrame('A3', 870, 899);
		expect(a1).toBeLessThan(a2);
		expect(a2).toBeLessThan(a3);
		expect([a1, a2, a3].map((f) => Math.round((f / 30) * 10) / 10)).toEqual([27.4, 28.4, 29.4]);
		for (const st of states.slice(850)) {
			expect(st.env.resonance).toBe(1);
		}
	});
});

describe('C003.8 main knot obeys the C002 deformation constraints', () => {
	it('every frame: Φ params inside the spec bounds; only allowed primitives', () => {
		for (const f of FRAMES) {
			const p = filmDeformationParams(f);
			expect(validateDeformationParams(FILM_SPEC, p).errors).toEqual([]);
			expect(states[f].deformation.steps.map((s) => s.kind)).toEqual(['twist', 'scale', 'rotation']);
		}
	});

	it('Φ is the identity in ACT I and at the final frame', () => {
		for (const f of [...FRAMES.slice(0, 150), 899]) {
			expect(filmDeformationParams(f)).toEqual({yaw: 0, pitch: 0, roll: 0, scale: 1, twist: 0});
		}
	});

	it('every frame: orientation preserved, exactly invertible, closed curve, tube thinner than 0.3 × separation', () => {
		const samples = sampleUniformParameter(FILM_SPEC.knot, 240);
		let minRatio = Infinity;
		let minSep = Infinity;
		let maxInv = 0;
		for (const st of states) {
			const d = st.deformation;
			const inv = invertDeformation(d);
			const pts = samples.map((v) => applyDeformation(d, v));
			for (let i = 0; i < samples.length; i += 24) {
				expect(jacobianDeterminant(d, samples[i])).toBeGreaterThan(0);
				maxInv = Math.max(maxInv, distance(applyDeformation(inv, pts[i]), samples[i]));
			}
			expect(distance(applyDeformation(d, knotPoint(FILM_SPEC.knot, 1)), pts[0])).toBeLessThan(1e-12);
			const sep = minSeparation(pts, 15);
			minSep = Math.min(minSep, sep);
			minRatio = Math.min(minRatio, sep / CORE_TUBE_RADIUS);
		}
		expect(maxInv).toBeLessThan(1e-9);
		expect(CORE_TUBE_RADIUS).toBeLessThanOrEqual(TUBE_RADIUS_TO_SEPARATION_MAX * minSep);
		mkdirSync('out/test-logs', {recursive: true});
		writeFileSync('out/test-logs/film-geometry.json', JSON.stringify({frames: FRAMES.length, minStrandSeparation: minSep, coreTubeRadius: CORE_TUBE_RADIUS, separationOverRadius: minRatio, maxInverseError: maxInv}, null, 2));
	});

	it('arc reveal is a monotone draw mask that ends tiling K exactly', () => {
		let prev = arcRevealAt(0);
		for (const f of FRAMES) {
			const r = arcRevealAt(f);
			r.forEach((v, i) => {
				expect(v).toBeGreaterThanOrEqual(prev[i] - 1e-15);
				expect(v).toBeGreaterThanOrEqual(0);
				expect(v).toBeLessThanOrEqual(1);
			});
			prev = r;
		}
		for (const f of FRAMES.slice(745)) {
			const arcs = states[f].arcs;
			expect(arcs.map((a) => a.reveal)).toEqual([1, 1, 1]);
			arcs.forEach((a, i) => expect(a.s0 + a.length).toBeCloseTo(i === 2 ? 1 : arcs[i + 1].s0, 12));
		}
	});
});

describe('C003.8 no NaN / Infinity / invalid geometry', () => {
	it('every number in every frame state is finite', () => {
		for (const st of states) {
			const {deformation, ...rest} = st;
			assertAllFinite(rest, `frame ${st.frame}`);
			assertAllFinite(deformation.steps, `frame ${st.frame}.deformation`);
		}
	});

	it('no degenerate geometry: alphas/intensities in [0, 1], arc lengths ≥ 0', () => {
		const violations: string[] = [];
		const inUnit = (x: number) => x >= 0 && x <= 1;
		for (const st of states) {
			for (const l of [...st.peripheryEdges, ...st.coreLinks, ...st.chords]) {
				if (!inUnit(l.alpha)) violations.push(`frame ${st.frame}: line alpha ${l.alpha}`);
			}
			for (const p of [...st.peripheryNodes, ...st.signals]) {
				if (!inUnit(p.intensity)) violations.push(`frame ${st.frame}: point intensity ${p.intensity}`);
			}
			for (const a of st.arcs) if (!(a.length >= 0)) violations.push(`frame ${st.frame}: arc length ${a.length}`);
		}
		expect(violations).toEqual([]);
	});
});
