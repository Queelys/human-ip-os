import {describe, expect, it} from 'vitest';
import {DEFAULT_MI_SPEC, graphSignature, identityFingerprint, serializeSpec} from '../src/identity/miKernel';
import {
	DEFAULT_PERIPHERY_OPTIONS,
	generatePeriphery,
	peripheryNodePositionsAt,
} from '../src/geometry/neuralGraph';
import {sampleUniformParameter} from '../src/geometry/trefoil';
import {distance} from '../src/geometry/vec3';

const spec = DEFAULT_MI_SPEC;

describe('C002.6 periphery (neural network + particles)', () => {
	it('is reproducible from the seed', () => {
		const a = generatePeriphery(spec);
		const b = generatePeriphery(spec);
		expect(b.nodes).toEqual(a.nodes);
		expect(b.edges).toEqual(a.edges);
		expect(Array.from(b.particles)).toEqual(Array.from(a.particles));
	});

	it('may vary by variant, while the identity core stays untouched', () => {
		const fp = identityFingerprint(spec);
		const json = serializeSpec(spec);
		const sig = graphSignature(spec);
		const core = sampleUniformParameter(spec.knot, 256);
		const a = generatePeriphery(spec, {...DEFAULT_PERIPHERY_OPTIONS, variant: 'a'});
		const b = generatePeriphery(spec, {...DEFAULT_PERIPHERY_OPTIONS, variant: 'b', nodeCount: 40});
		expect(a.nodes).not.toEqual(b.nodes);
		expect(identityFingerprint(spec)).toBe(fp);
		expect(serializeSpec(spec)).toBe(json);
		expect(graphSignature(spec)).toBe(sig);
		expect(sampleUniformParameter(spec.knot, 256)).toEqual(core);
	});

	it('nodes keep clearance from the core curve; edges are valid', () => {
		const p = generatePeriphery(spec);
		const dense = sampleUniformParameter(spec.knot, 2048);
		expect(p.nodes.length).toBe(DEFAULT_PERIPHERY_OPTIONS.nodeCount);
		for (const n of p.nodes) {
			const d = Math.min(...dense.map((c) => distance(c, n.position)));
			expect(d).toBeGreaterThanOrEqual(DEFAULT_PERIPHERY_OPTIONS.clearance * 0.98);
		}
		for (const [i, j] of p.edges) {
			expect(i).toBeLessThan(j);
			expect(j).toBeLessThan(p.nodes.length);
		}
		expect(new Set(p.edges.map((e) => e.join('-'))).size).toBe(p.edges.length);
		expect(p.particles.length).toBe(DEFAULT_PERIPHERY_OPTIONS.particleCount * 3);
		expect(Object.isFrozen(p.nodes)).toBe(true);
	});

	it('time-driven wobble is pure and bounded', () => {
		const p = generatePeriphery(spec);
		const a = peripheryNodePositionsAt(p, 12.3);
		const b = peripheryNodePositionsAt(p, 12.3);
		expect(b).toEqual(a);
		const amp = DEFAULT_PERIPHERY_OPTIONS.wobbleAmplitude;
		a.forEach((v, i) => expect(distance(v, p.nodes[i].position)).toBeLessThanOrEqual(amp * Math.sqrt(3) + 1e-12));
	});
});
