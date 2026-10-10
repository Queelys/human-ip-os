import {describe, expect, it} from 'vitest';
import {createCoreGeometry, createSatelliteField} from '../src/core/geometry';
import {assertKernelConsistent, MI_IDENTITY} from '../src/core/identity';
import {eulerCharacteristic} from '../src/core/topology';

describe('Mi identity kernel', () => {
	it('is frozen and internally consistent', () => {
		expect(Object.isFrozen(MI_IDENTITY)).toBe(true);
		expect(Object.isFrozen(MI_IDENTITY.invariants)).toBe(true);
		expect(() => assertKernelConsistent(MI_IDENTITY)).not.toThrow();
	});

	it('rejects an inconsistent kernel', () => {
		expect(() =>
			assertKernelConsistent({
				...MI_IDENTITY,
				invariants: {...MI_IDENTITY.invariants, eulerCharacteristic: 2},
			}),
		).toThrow();
	});

	it('core geometry preserves the declared Euler characteristic', () => {
		const geo = createCoreGeometry(MI_IDENTITY);
		const chi = eulerCharacteristic({
			positions: geo.getAttribute('position').array,
			indices: geo.getIndex()!.array,
		});
		expect(chi).toBe(MI_IDENTITY.invariants.eulerCharacteristic);
	});

	it('satellite field is reproducible from the seed', () => {
		const a = createSatelliteField(MI_IDENTITY, 500);
		const b = createSatelliteField(MI_IDENTITY, 500);
		expect(Array.from(a)).toEqual(Array.from(b));
	});
});

// ── C002: MI Identity Kernel V1.0 ────────────────────────────────────────

import {anchorStates} from '../src/identity/anchors';
import {IDENTITY_INVARIANTS, validateSpec} from '../src/identity/invariants';
import {
	DEFAULT_MI_SPEC,
	graphSignature,
	identityFingerprint,
	type MiIdentitySpec,
	MI_SPEC_VERSION,
	parseSpec,
	serializeSpec,
} from '../src/identity/miKernel';
import {knotPoint} from '../src/geometry/trefoil';
import {deformationFromParams} from '../src/motion/deformation';

type DeepMutable<T> = {-readonly [K in keyof T]: DeepMutable<T[K]>};
type MutableSpec = DeepMutable<MiIdentitySpec>;

/** Deep-clone the default spec and apply a mutation (for negative tests). */
const mutate = (fn: (s: MutableSpec) => void): MiIdentitySpec => {
	const clone = JSON.parse(JSON.stringify(DEFAULT_MI_SPEC));
	fn(clone);
	return clone as MiIdentitySpec;
};

describe('C002.1 identity data model', () => {
	it('default spec is valid', () => {
		expect(validateSpec(DEFAULT_MI_SPEC)).toEqual({ok: true, errors: []});
	});

	it('is deep-frozen (presentation code cannot mutate identity)', () => {
		expect(Object.isFrozen(DEFAULT_MI_SPEC.knot)).toBe(true);
		expect(Object.isFrozen(DEFAULT_MI_SPEC.anchors[1])).toBe(true);
		expect(Object.isFrozen(DEFAULT_MI_SPEC.graph.edges[0])).toBe(true);
		expect(() => {
			(DEFAULT_MI_SPEC.anchors[0] as {s: number}).s = 0.5;
		}).toThrow(TypeError);
	});

	it('serialises canonically and round-trips', () => {
		const json = serializeSpec(DEFAULT_MI_SPEC);
		const back = parseSpec(json);
		expect(serializeSpec(back)).toBe(json);
		expect(identityFingerprint(back)).toBe(identityFingerprint(DEFAULT_MI_SPEC));
		expect(Object.isFrozen(back.anchors[0])).toBe(true);
	});

	it('is versioned: σ = (seed, version)', () => {
		expect(DEFAULT_MI_SPEC.version).toBe(MI_SPEC_VERSION);
		expect(DEFAULT_MI_SPEC.seed).toBe(0x4b4c4d49);
		expect(() => parseSpec(JSON.stringify({...DEFAULT_MI_SPEC, version: '2.0.0'}))).toThrow(/Unsupported/);
		expect(() => parseSpec(JSON.stringify({...DEFAULT_MI_SPEC, schema: 'x'}))).toThrow(/schema/);
	});

	it('locks the identity fingerprint and graph signature (regression guard)', () => {
		expect(identityFingerprint(DEFAULT_MI_SPEC)).toMatchInlineSnapshot(`"cd2e236379d37be5"`);
		expect(graphSignature(DEFAULT_MI_SPEC)).toMatchInlineSnapshot(`"E12:A1->A2[成形 form]|E23:A2->A3[传导 conduct]|E31:A3->A1[回归 return]"`);
	});

	it('fingerprint changes when any identity component changes', () => {
		const base = identityFingerprint(DEFAULT_MI_SPEC);
		const variants = [
			mutate((s) => (s.seed = 1)),
			mutate((s) => (s.version = '1.0.1')),
			mutate((s) => (s.knot.majorRadius = 1.3)),
			mutate((s) => (s.anchors[1].s = 0.34)),
			mutate((s) => (s.graph.edges[0].label = 'x')),
			mutate((s) => (s.pulse.width = 0.3)),
			mutate((s) => (s.deformation.twistRateMax = 1)),
		];
		for (const v of variants) {
			expect(identityFingerprint(v)).not.toBe(base);
		}
	});

	it.each([
		['non-semver version', (s: MutableSpec) => (s.version = 'v1')],
		['non-uint32 seed', (s: MutableSpec) => (s.seed = -1)],
		['mirror/other knot T(3,2)', (s: MutableSpec) => ((s.knot.p = 3), (s.knot.q = 2))],
		['non-coprime knot', (s: MutableSpec) => (s.knot.q = 4)],
		['minor ≥ major radius', (s: MutableSpec) => (s.knot.minorRadius = 1.2)],
		['anchor out of range', (s: MutableSpec) => (s.anchors[2].s = 1)],
		['anchor order broken', (s: MutableSpec) => (s.anchors[1].s = 0.9)],
		['anchor id swapped', (s: MutableSpec) => (s.anchors[0].id = 'A2')],
		['graph missing edge', (s: MutableSpec) => s.graph.edges.pop()],
		['graph self loop', (s: MutableSpec) => (s.graph.edges[0].to = 'A1')],
		['duplicate phase', (s: MutableSpec) => (s.pulse.phaseOffsets[1] = 0)],
		['zero period', (s: MutableSpec) => (s.pulse.periodSeconds = 0)],
		['non-positive scale bound', (s: MutableSpec) => (s.deformation.scale.min = 0)],
		['extra deformation kind', (s: MutableSpec) => (s.deformation.allowed as unknown as string[]).push('vertex-noise')],
	])('rejects invalid spec: %s', (_name, fn) => {
		expect(validateSpec(mutate(fn)).ok).toBe(false);
	});

	it('declares every invariant with an id', () => {
		expect(IDENTITY_INVARIANTS.map((i) => i.id)).toEqual([
			'INV-K1', 'INV-K2', 'INV-A1', 'INV-A2', 'INV-G1', 'INV-P1', 'INV-Φ1', 'INV-σ1',
		]);
	});

	it('C001 view is derived from the V1.0 spec (single source of truth)', () => {
		expect(MI_IDENTITY.seed).toBe(DEFAULT_MI_SPEC.seed);
		expect(MI_IDENTITY.invariants.knot).toEqual({p: DEFAULT_MI_SPEC.knot.p, q: DEFAULT_MI_SPEC.knot.q});
	});
});

describe('C002.3 anchor identity stability', () => {
	it('anchors are defined by curve parameter, not vertex index', () => {
		const states = anchorStates(DEFAULT_MI_SPEC);
		expect(states.map((a) => a.id)).toEqual(['A1', 'A2', 'A3']);
		states.forEach((a, i) => {
			expect(a.s).toBe(DEFAULT_MI_SPEC.anchors[i].s);
			expect(a.local).toEqual(knotPoint(DEFAULT_MI_SPEC.knot, a.s));
		});
	});

	it('anchor positions are identical across repeated evaluation', () => {
		const a = anchorStates(DEFAULT_MI_SPEC);
		const b = anchorStates(DEFAULT_MI_SPEC);
		expect(b).toEqual(a);
	});

	it('anchor world = Φ(K(s)) and labels/order survive deformation', () => {
		const D = deformationFromParams(DEFAULT_MI_SPEC, {yaw: 1, pitch: -0.4, roll: 0.2, scale: 1.7, twist: 1.1});
		const states = anchorStates(DEFAULT_MI_SPEC, D);
		expect(states.map((a) => `${a.id}:${a.label}:${a.s}`)).toEqual(
			DEFAULT_MI_SPEC.anchors.map((a) => `${a.id}:${a.label}:${a.s}`),
		);
		for (const st of states) {
			expect(st.world).not.toEqual(st.local);
		}
	});
});

describe('C002 core graph relations', () => {
	it('G is the labelled K3 on the three anchors', () => {
		const pairs = DEFAULT_MI_SPEC.graph.edges.map((e) => [e.from, e.to].sort().join('-')).sort();
		expect(pairs).toEqual(['A1-A2', 'A1-A3', 'A2-A3']);
		expect(DEFAULT_MI_SPEC.graph.edges.map((e) => e.id)).toEqual(['E12', 'E23', 'E31']);
	});

	it('graph signature is unchanged by deformation, periphery generation and serialisation', async () => {
		const {generatePeriphery} = await import('../src/geometry/neuralGraph');
		const before = graphSignature(DEFAULT_MI_SPEC);
		generatePeriphery(DEFAULT_MI_SPEC);
		anchorStates(DEFAULT_MI_SPEC, deformationFromParams(DEFAULT_MI_SPEC, {yaw: 2, pitch: 1, roll: 0, scale: 0.5, twist: -1.5}));
		expect(graphSignature(DEFAULT_MI_SPEC)).toBe(before);
		expect(graphSignature(parseSpec(serializeSpec(DEFAULT_MI_SPEC)))).toBe(before);
	});
});
