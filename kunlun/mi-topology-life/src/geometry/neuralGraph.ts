/**
 * Peripheral neural network + particle layer.
 *
 * The periphery is *derived from* the identity spec (read-only) but is not
 * part of the identity: it may vary by `variant`, by options and over time.
 * It never writes to the spec, never changes K or G, and is generated from a
 * seed derived from spec.seed so every variant is reproducible.
 */
import {createRng} from '../core/rng';
import type {MiIdentitySpec} from '../identity/miKernel';
import {knotDerivative, knotPoint, sampleUniformParameter} from './trefoil';
import {add, cross, distance, dot, normalize, scale, sub, type Vec3} from './vec3';

export type PeripheryOptions = {
	/** Variation key; different variants give different (reproducible) peripheries. */
	readonly variant: string;
	readonly nodeCount: number;
	/** Each node links to its k nearest neighbours. */
	readonly neighbours: number;
	readonly particleCount: number;
	/** Node offset from its base point on K. */
	readonly offset: {readonly min: number; readonly max: number};
	/** Minimum clearance from every sampled point of K. */
	readonly clearance: number;
	/** Peak amplitude of the time-driven wobble. */
	readonly wobbleAmplitude: number;
};

export const DEFAULT_PERIPHERY_OPTIONS: PeripheryOptions = Object.freeze({
	variant: 'default',
	nodeCount: 72,
	neighbours: 3,
	particleCount: 1500,
	offset: Object.freeze({min: 0.45, max: 1.1}),
	clearance: 0.3,
	wobbleAmplitude: 0.06,
});

export type PeripheryNode = {
	readonly position: Vec3;
	/** Curve parameter of the core point this node is rooted at. */
	readonly rootS: number;
	/** Per-node phase for the wobble, in [0, 1). */
	readonly phase: number;
};

export type Periphery = {
	readonly variant: string;
	readonly seed: number;
	readonly nodes: readonly PeripheryNode[];
	/** Undirected edges as sorted index pairs, sorted lexicographically. */
	readonly edges: readonly (readonly [number, number])[];
	/** Flat xyz particle positions. */
	readonly particles: Float32Array;
};

const CORE_PROBE_SAMPLES = 720;

const minDistanceToCore = (probe: readonly Vec3[], v: Vec3): number =>
	probe.reduce((m, c) => Math.min(m, distance(c, v)), Infinity);

export const generatePeriphery = (
	spec: MiIdentitySpec,
	options: PeripheryOptions = DEFAULT_PERIPHERY_OPTIONS,
): Periphery => {
	const rngNodes = createRng(spec.seed, `periphery:${options.variant}:nodes`);
	const rngParticles = createRng(spec.seed, `periphery:${options.variant}:particles`);
	const probe = sampleUniformParameter(spec.knot, CORE_PROBE_SAMPLES);

	const nodes: PeripheryNode[] = [];
	const MAX_TRIES = 64;
	for (let i = 0; i < options.nodeCount; i++) {
		let placed: PeripheryNode | null = null;
		for (let attempt = 0; attempt < MAX_TRIES && !placed; attempt++) {
			const s = rngNodes();
			const base = knotPoint(spec.knot, s);
			const t = normalize(knotDerivative(spec.knot, s));
			// Random direction, made orthogonal to the tangent.
			const r: Vec3 = [rngNodes() * 2 - 1, rngNodes() * 2 - 1, rngNodes() * 2 - 1];
			const perp = sub(r, scale(t, dot(r, t)));
			const dir = dot(perp, perp) > 1e-12 ? normalize(perp) : normalize(cross(t, [0, 0, 1]));
			const d = options.offset.min + rngNodes() * (options.offset.max - options.offset.min);
			const position = add(base, scale(dir, d));
			const phase = rngNodes();
			if (minDistanceToCore(probe, position) >= options.clearance) {
				placed = {position, rootS: s, phase};
			}
		}
		if (!placed) {
			throw new Error(`Periphery: could not place node ${i} with clearance ${options.clearance}`);
		}
		nodes.push(placed);
	}

	const edgeSet = new Set<string>();
	nodes.forEach((n, i) => {
		nodes
			.map((m, j) => ({j, d: distance(n.position, m.position)}))
			.filter(({j}) => j !== i)
			.sort((a, b) => a.d - b.d || a.j - b.j)
			.slice(0, options.neighbours)
			.forEach(({j}) => edgeSet.add(i < j ? `${i}-${j}` : `${j}-${i}`));
	});
	const edges = [...edgeSet]
		.map((k) => k.split('-').map(Number) as [number, number])
		.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

	const particles = new Float32Array(options.particleCount * 3);
	for (let i = 0; i < options.particleCount; i++) {
		const arm = i % 3;
		const r = 2.4 + rngParticles() * 2.8;
		const theta = (arm / 3) * Math.PI * 2 + Math.log(r) * 2.4 + (rngParticles() - 0.5) * 0.6;
		particles[i * 3] = Math.cos(theta) * r;
		particles[i * 3 + 1] = Math.sin(theta) * r;
		particles[i * 3 + 2] = (rngParticles() - 0.5) * (1.2 / r);
	}

	return Object.freeze({
		variant: options.variant,
		seed: spec.seed,
		nodes: Object.freeze(nodes.map((n) => Object.freeze(n))),
		edges: Object.freeze(edges.map((e) => Object.freeze(e))),
		particles,
	});
};

/**
 * Node positions at time t: base position plus a bounded, closed-form wobble.
 * Pure in t — the periphery is allowed to move, the core is not touched.
 */
export const peripheryNodePositionsAt = (
	periphery: Periphery,
	timeSeconds: number,
	amplitude = DEFAULT_PERIPHERY_OPTIONS.wobbleAmplitude,
	periodSeconds = 4,
): Vec3[] =>
	periphery.nodes.map((n) => {
		const a = Math.PI * 2 * (timeSeconds / periodSeconds + n.phase);
		return add(n.position, [amplitude * Math.sin(a), amplitude * Math.cos(a * 1.3), amplitude * Math.sin(a * 0.7)]);
	});
