/**
 * MI Identity Kernel V1.0 — MI = (G, K, A, P, Φ, σ).
 *
 *   G  labelled three-anchor core relation graph   → `graph`
 *   K  trefoil closed curve                         → `knot`
 *   A  three permanent identity anchors             → `anchors`
 *   P  fixed-phase-offset pulse protocol            → `pulse`
 *   Φ  constrained continuous invertible deformations → `deformation`
 *   σ  fixed random seed + identity version         → `seed`, `version`
 *
 * The spec is plain JSON data: serialisable, versioned and deep-frozen.
 * Nothing in the presentation layer may mutate it. Validation lives in
 * ./invariants.ts.
 */
import {hashString} from '../core/rng';

export const MI_SPEC_SCHEMA = 'kunlun.mi.identity' as const;
export const MI_SPEC_VERSION = '1.0.0' as const;

export type AnchorId = 'A1' | 'A2' | 'A3';

export type MiAnchor = {
	readonly id: AnchorId;
	/** Display label. */
	readonly label: string;
	/** Permanent position on K, as a curve parameter s ∈ [0, 1). */
	readonly s: number;
};

export type MiEdge = {
	readonly id: string;
	readonly from: AnchorId;
	readonly to: AnchorId;
	readonly label: string;
};

export type MiIdentitySpec = {
	readonly schema: typeof MI_SPEC_SCHEMA;
	/** Identity version (semver). σ part 1. */
	readonly version: string;
	/** Root random seed (uint32). σ part 2. */
	readonly seed: number;
	/** K. */
	readonly knot: {
		readonly type: 'torus-knot';
		readonly p: number;
		readonly q: number;
		readonly majorRadius: number;
		readonly minorRadius: number;
	};
	/** A. Exactly three anchors, ordered by increasing s. */
	readonly anchors: readonly [MiAnchor, MiAnchor, MiAnchor];
	/** G. Nodes are the anchor ids; edges are labelled. */
	readonly graph: {
		readonly nodes: readonly AnchorId[];
		readonly edges: readonly MiEdge[];
	};
	/** P. */
	readonly pulse: {
		readonly periodSeconds: number;
		/** Phase offset of each anchor as a fraction of the period, in [0, 1). */
		readonly phaseOffsets: readonly [number, number, number];
		/** Active fraction of the period during which the pulse is non-zero, in (0, 1]. */
		readonly width: number;
		readonly waveform: 'raised-cosine';
	};
	/** Φ: allowed deformation family and its bounds. */
	readonly deformation: {
		readonly allowed: readonly ['rotation-so3', 'uniform-scale', 'z-twist'];
		readonly scale: {readonly min: number; readonly max: number};
		/** Maximum |twist rate| in radians per unit z. */
		readonly twistRateMax: number;
	};
};

const deepFreeze = <T>(value: T): T => {
	if (value && typeof value === 'object' && !Object.isFrozen(value)) {
		Object.freeze(value);
		for (const v of Object.values(value)) {
			deepFreeze(v);
		}
	}
	return value;
};

export const DEFAULT_MI_SPEC: MiIdentitySpec = deepFreeze({
	schema: MI_SPEC_SCHEMA,
	version: MI_SPEC_VERSION,
	seed: 0x4b4c4d49, // "KLMI" — unchanged since C001
	knot: {type: 'torus-knot', p: 2, q: 3, majorRadius: 1.2, minorRadius: 0.6},
	anchors: [
		{id: 'A1', label: '骨 Structure', s: 0},
		{id: 'A2', label: '脉 Signal', s: 1 / 3},
		{id: 'A3', label: '息 Breath', s: 2 / 3},
	],
	graph: {
		nodes: ['A1', 'A2', 'A3'],
		edges: [
			{id: 'E12', from: 'A1', to: 'A2', label: '成形 form'},
			{id: 'E23', from: 'A2', to: 'A3', label: '传导 conduct'},
			{id: 'E31', from: 'A3', to: 'A1', label: '回归 return'},
		],
	},
	pulse: {
		periodSeconds: 3,
		phaseOffsets: [0, 1 / 3, 2 / 3],
		width: 0.25,
		waveform: 'raised-cosine',
	},
	deformation: {
		allowed: ['rotation-so3', 'uniform-scale', 'z-twist'],
		scale: {min: 0.25, max: 3},
		twistRateMax: Math.PI / 2,
	},
} satisfies MiIdentitySpec);

/** Recursively sort object keys so serialisation is canonical. */
const canonical = (v: unknown): unknown => {
	if (Array.isArray(v)) {
		return v.map(canonical);
	}
	if (v && typeof v === 'object') {
		return Object.fromEntries(
			Object.keys(v as object)
				.sort()
				.map((k) => [k, canonical((v as Record<string, unknown>)[k])]),
		);
	}
	return v;
};

export const serializeSpec = (spec: MiIdentitySpec): string =>
	JSON.stringify(canonical(spec), null, 2);

/**
 * Parse JSON into a frozen spec. Structural validation only; call
 * `validateSpec` from ./invariants for the mathematical constraints.
 */
export const parseSpec = (json: string): MiIdentitySpec => {
	const raw = JSON.parse(json) as Partial<MiIdentitySpec>;
	if (raw.schema !== MI_SPEC_SCHEMA) {
		throw new Error(`Unknown spec schema: ${String(raw.schema)}`);
	}
	if (typeof raw.version !== 'string' || raw.version.split('.')[0] !== MI_SPEC_VERSION.split('.')[0]) {
		throw new Error(`Unsupported identity version ${String(raw.version)} (supported: ${MI_SPEC_VERSION})`);
	}
	return deepFreeze(raw as MiIdentitySpec);
};

/**
 * Identity fingerprint: FNV-1a (two independent lanes → 64 bits as hex) over
 * the canonical serialisation. Any change to G, K, A, P, Φ or σ changes it.
 */
export const identityFingerprint = (spec: MiIdentitySpec): string => {
	const text = serializeSpec(spec);
	const h1 = hashString(text);
	const h2 = hashString(`mi:${text}`);
	return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
};

/** Canonical one-line signature of G (sorted edges with labels). */
export const graphSignature = (spec: MiIdentitySpec): string =>
	[...spec.graph.edges]
		.map((e) => `${e.id}:${e.from}->${e.to}[${e.label}]`)
		.sort()
		.join('|');
