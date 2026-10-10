/**
 * Identity invariants of Mi and their validators.
 *
 * Two kinds of guarantees are kept strictly apart:
 *  - STRUCTURAL: exact checks on the spec (integers, ordering, graph shape).
 *  - NUMERICAL:  floating-point checks on sampled geometry. These detect
 *    implementation bugs; they are NOT topological proofs. The proofs are in
 *    docs/MI_MATH_RULES.md.
 */
import {analyzeSampling, closureGap, knotDerivative, totalCurvature} from '../geometry/trefoil';
import {distance, length} from '../geometry/vec3';
import type {AnchorId, MiIdentitySpec} from './miKernel';

const ANCHOR_IDS: readonly AnchorId[] = ['A1', 'A2', 'A3'];

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

export type ValidationResult = {readonly ok: boolean; readonly errors: readonly string[]};

/** Structural + constraint validation of a spec. Exact, no tolerances. */
export const validateSpec = (spec: MiIdentitySpec): ValidationResult => {
	const errors: string[] = [];
	const req = (cond: boolean, msg: string) => {
		if (!cond) errors.push(msg);
	};

	// σ
	req(/^\d+\.\d+\.\d+$/.test(spec.version), `version must be semver, got "${spec.version}"`);
	req(Number.isInteger(spec.seed) && spec.seed >= 0 && spec.seed <= 0xffffffff, 'seed must be a uint32');

	// K
	const {p, q, majorRadius: R, minorRadius: a} = spec.knot;
	req(spec.knot.type === 'torus-knot', 'knot.type must be torus-knot');
	req(Number.isInteger(p) && Number.isInteger(q), 'knot p, q must be integers');
	req(p === 2 && q === 3, `identity knot must be the trefoil T(2,3), got T(${p},${q})`);
	req(gcd(p, q) === 1, 'gcd(p, q) must be 1');
	req(Number.isFinite(R) && Number.isFinite(a) && a > 0 && R > a, 'radii must satisfy 0 < minorRadius < majorRadius');

	// A
	req(spec.anchors.length === 3, 'exactly three anchors are required');
	spec.anchors.forEach((anc, i) => {
		req(anc.id === ANCHOR_IDS[i], `anchor ${i} must have id ${ANCHOR_IDS[i]}`);
		req(Number.isFinite(anc.s) && anc.s >= 0 && anc.s < 1, `anchor ${anc.id}.s must be in [0, 1)`);
		req(anc.label.trim().length > 0, `anchor ${anc.id} needs a label`);
	});
	req(
		spec.anchors[0].s < spec.anchors[1].s && spec.anchors[1].s < spec.anchors[2].s,
		'anchors must be strictly increasing in s (fixes the cyclic order along K)',
	);

	// G
	const nodes = [...spec.graph.nodes].sort();
	req(JSON.stringify(nodes) === JSON.stringify(ANCHOR_IDS), 'graph nodes must be exactly A1, A2, A3');
	const pairs = new Set(spec.graph.edges.map((e) => [e.from, e.to].sort().join('-')));
	req(spec.graph.edges.length === 3 && pairs.size === 3, 'graph must have exactly three distinct edges');
	for (const pair of ['A1-A2', 'A2-A3', 'A1-A3']) {
		req(pairs.has(pair), `graph is missing edge ${pair}`);
	}
	req(spec.graph.edges.every((e) => e.from !== e.to), 'graph edges must not be self-loops');
	req(new Set(spec.graph.edges.map((e) => e.id)).size === spec.graph.edges.length, 'edge ids must be unique');

	// P
	const P = spec.pulse;
	req(Number.isFinite(P.periodSeconds) && P.periodSeconds > 0, 'pulse.periodSeconds must be > 0');
	req(P.phaseOffsets.length === 3 && P.phaseOffsets.every((o) => o >= 0 && o < 1), 'phase offsets must be in [0, 1)');
	req(new Set(P.phaseOffsets).size === 3, 'phase offsets must be distinct');
	req(P.width > 0 && P.width <= 1, 'pulse.width must be in (0, 1]');
	req(P.waveform === 'raised-cosine', 'pulse.waveform must be raised-cosine');

	// Φ
	const D = spec.deformation;
	req(
		JSON.stringify(D.allowed) === JSON.stringify(['rotation-so3', 'uniform-scale', 'z-twist']),
		'deformation.allowed must be exactly rotation-so3, uniform-scale, z-twist',
	);
	req(D.scale.min > 0 && D.scale.max >= D.scale.min && Number.isFinite(D.scale.max), 'scale bounds must satisfy 0 < min ≤ max');
	req(D.scale.min <= 1 && D.scale.max >= 1, 'scale bounds must include the identity (1)');
	req(Number.isFinite(D.twistRateMax) && D.twistRateMax >= 0, 'twistRateMax must be finite and ≥ 0');

	return {ok: errors.length === 0, errors};
};

export const assertValidSpec = (spec: MiIdentitySpec): void => {
	const {ok, errors} = validateSpec(spec);
	if (!ok) {
		throw new Error(`Invalid MiIdentitySpec:\n- ${errors.join('\n- ')}`);
	}
};

/** Declared identity invariants (documentation-as-data, mirrored in MI_IDENTITY_SPEC.md). */
export const IDENTITY_INVARIANTS = [
	{id: 'INV-K1', text: 'K is the torus knot T(2,3) (trefoil) with fixed chirality; only orientation-preserving ambient isotopies are applied.'},
	{id: 'INV-K2', text: 'K is closed, regular (|K′| > 0) and embedded: 0 < a < R, gcd(p,q) = 1.'},
	{id: 'INV-A1', text: 'Anchors A1, A2, A3 are defined by fixed curve parameters s; their world position is always Φ(K(s)).'},
	{id: 'INV-A2', text: 'Anchor cyclic order along K is A1 → A2 → A3.'},
	{id: 'INV-G1', text: 'G is the labelled complete graph on {A1, A2, A3} with edges E12, E23, E31.'},
	{id: 'INV-P1', text: 'Pulse phases differ by fixed offsets; pulse(t) is a pure function of t.'},
	{id: 'INV-Φ1', text: 'Core deformations are only compositions of SO(3) rotation, positive uniform scale and z-twist.'},
	{id: 'INV-σ1', text: 'All randomness derives from the spec seed; the identity fingerprint is stable.'},
] as const;

/** Numerical tolerances used by the geometry checks. */
export const NUMERIC_TOLERANCE = {
	closure: 1e-12,
	tangentContinuity: 1e-9,
	inverse: 1e-9,
} as const;

export type GeometryReport = {
	readonly closureGap: number;
	readonly tangentGap: number;
	readonly minSpeed: number;
	readonly sampling: ReturnType<typeof analyzeSampling>;
	readonly totalCurvature: number;
};

/** Numerical geometry report on K (not a proof; see module doc). */
export const geometryReport = (spec: MiIdentitySpec, samples = 512): GeometryReport => {
	let minSpeed = Infinity;
	for (let i = 0; i < 4096; i++) {
		minSpeed = Math.min(minSpeed, length(knotDerivative(spec.knot, i / 4096)));
	}
	return {
		closureGap: closureGap(spec.knot),
		tangentGap: distance(knotDerivative(spec.knot, 0), knotDerivative(spec.knot, 1)),
		minSpeed,
		sampling: analyzeSampling(spec.knot, samples),
		totalCurvature: totalCurvature(spec.knot),
	};
};
