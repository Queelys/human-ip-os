/**
 * C003.4 five-act choreography as pure functions of the global frame.
 *
 * Identity data is never copied or edited here: the spec, anchors, Φ and P
 * all come from the C002 kernel (DEFAULT_MI_SPEC, anchorStates,
 * deformationFromParams, pulseIntensity). This module only decides *when*
 * and *how strongly* things are shown — visibility, reveal ranges, glow —
 * and which Φ parameters to request (which the kernel validates).
 */
import {FILM} from '../config/film';
import {createRng} from '../core/rng';
import {generatePeriphery, peripheryNodePositionsAt, type PeripheryOptions} from '../geometry/neuralGraph';
import {knotPoint} from '../geometry/trefoil';
import type {Vec3} from '../geometry/vec3';
import {anchorStates} from '../identity/anchors';
import {type AnchorId, DEFAULT_MI_SPEC, type MiIdentitySpec} from '../identity/miKernel';
import {
	applyDeformation,
	type Deformation,
	type DeformationParams,
	deformationFromParams,
} from '../motion/deformation';
import {pulseIntensity} from '../motion/pulse';
import {cameraAt, type CameraState} from './camera';
import {clamp, lerp as lerpN, ramp, ramps, smootherstep} from './easing';

export const FILM_SPEC: MiIdentitySpec = DEFAULT_MI_SPEC;

// ── Φ(t): requested deformation parameters ────────────────────────────────

/**
 * Deformation parameters per frame. Acts I–II rest at identity, III tilts
 * gently, IV performs the main continuous invertible transformation, V eases
 * every parameter back to identity by frame 840. Each channel is a sum of
 * smootherstep ramps whose deltas sum to zero, so Φ(899) = id exactly.
 */
export const filmDeformationParams = (frame: number, spec: MiIdentitySpec = FILM_SPEC): DeformationParams => {
	const k = spec.deformation.twistRateMax;
	return {
		yaw: ramps(frame, [
			[540, 650, 0.4],
			[650, 840, -0.4],
		]),
		pitch: ramps(frame, [
			[330, 539, 0.35],
			[540, 700, 0.25],
			[700, 840, -0.6],
		]),
		roll: ramps(frame, [
			[150, 539, 0.6],
			[540, 749, 0.5],
			[750, 840, -1.1],
		]),
		scale:
			1 +
			ramps(frame, [
				[540, 640, -0.12],
				[640, 749, 0.2],
				[750, 840, -0.08],
			]),
		twist:
			k *
			ramps(frame, [
				[560, 650, 0.7],
				[650, 749, -1.2],
				[750, 840, 0.5],
			]),
	};
};

/** Φ(t) built and validated by the C002 kernel (throws outside Φ bounds). */
export const filmDeformation = (frame: number, spec: MiIdentitySpec = FILM_SPEC): Deformation =>
	deformationFromParams(spec, filmDeformationParams(frame, spec));

// ── envelopes ─────────────────────────────────────────────────────────────

export type Envelopes = {
	/** Background gradient strength. */
	readonly background: number;
	/** Star layers (far, mid, near). */
	readonly stars: number;
	readonly anchorVisibility: Record<AnchorId, number>;
	/** Gain applied to the P-protocol pulse (presentation only). */
	readonly pulseGain: number;
	/** Shared resonance of all three anchors in ACT V (presentation only). */
	readonly resonance: number;
	/** Brightness of the core-graph chords G. */
	readonly chords: number;
	/** Glow strength of the core knot. */
	readonly coreGlow: number;
	readonly peripheryOpacity: number;
	readonly peripheryWobble: number;
	readonly signals: number;
	readonly discParticles: number;
	readonly trails: number;
	readonly caption: number;
};

export const CAPTION_START_FRAME = 840;
/** Caption fade-in length (0.8 s); fully visible from frame 864 (28.8 s). */
export const CAPTION_FADE_FRAMES = 24;

export const envelopesAt = (f: number): Envelopes => ({
	background: ramp(f, 0, 150, 0.15, 0.45) + ramp(f, 150, 400, 0, 0.55),
	stars: ramp(f, 10, 149, 0, 0.3) + ramp(f, 150, 360, 0, 0.7),
	anchorVisibility: {
		A1: ramp(f, 15, 135, 0, 1),
		A2: ramp(f, 165, 240, 0, 1),
		A3: ramp(f, 190, 265, 0, 1),
	},
	pulseGain: ramp(f, 150, 240, 0.35, 1),
	resonance: ramp(f, 800, 850, 0, 1),
	chords: ramp(f, 420, 500, 0, 0.18) + ramp(f, 790, 850, 0, 0.5),
	coreGlow: ramp(f, 160, 330, 0.55, 0.75) + ramp(f, 560, 720, 0, 0.45),
	peripheryOpacity: ramp(f, 330, 380, 0, 1) - ramp(f, 760, 850, 0, 0.8),
	peripheryWobble: ramp(f, 330, 420, 0, 1) - ramp(f, 750, 840, 0, 1),
	signals: ramp(f, 380, 440, 0, 1) - ramp(f, 740, 820, 0, 1),
	discParticles: ramp(f, 360, 520, 0, 0.8) - ramp(f, 760, 860, 0, 0.4),
	trails: ramp(f, 560, 600, 0, 1) - ramp(f, 720, 760, 0, 1),
	caption: ramp(f, CAPTION_START_FRAME, CAPTION_START_FRAME + CAPTION_FADE_FRAMES, 0, 1),
});

// ── C003.4 ACT II: asymmetric trajectories (reveal of K arcs) ────────────

/**
 * Revealed fraction (0..1) of each anchor-to-anchor arc of K. Arc i starts at
 * anchor i and grows forward along K toward anchor i+1. Different delays and
 * speeds break the three-fold symmetry visually; by frame 745 all three arcs
 * are complete and tile K exactly. This is a draw mask — K itself is never
 * altered.
 */
export const arcRevealAt = (f: number): readonly [number, number, number] => [
	clamp(ramps(f, [[175, 320, 0.45], [340, 530, 0.2], [560, 720, 0.35]]), 0, 1),
	clamp(ramps(f, [[200, 329, 0.28], [350, 539, 0.32], [575, 735, 0.4]]), 0, 1),
	clamp(ramps(f, [[230, 329, 0.18], [380, 539, 0.22], [590, 745, 0.6]]), 0, 1),
];

// ── periphery (ACT III) ──────────────────────────────────────────────────

export const FILM_PERIPHERY_OPTIONS: PeripheryOptions = Object.freeze({
	variant: 'c003-film',
	nodeCount: 84,
	neighbours: 3,
	particleCount: 1400,
	offset: Object.freeze({min: 0.5, max: 1.45}),
	clearance: 0.32,
	wobbleAmplitude: 0.05,
});

const PERIPHERY = generatePeriphery(FILM_SPEC, FILM_PERIPHERY_OPTIONS);

const circularGap = (a: number, b: number) => {
	const d = Math.abs(a - b) % 1;
	return Math.min(d, 1 - d);
};

/** Growth schedule: nodes rooted closest to an anchor appear first. */
const NODE_APPEAR: readonly number[] = (() => {
	const order = PERIPHERY.nodes
		.map((n, i) => ({i, d: Math.min(...FILM_SPEC.anchors.map((a) => circularGap(n.rootS, a.s)))}))
		.sort((a, b) => a.d - b.d || a.i - b.i);
	const appear: number[] = new Array(PERIPHERY.nodes.length);
	order.forEach(({i}, rank) => {
		appear[i] = 340 + Math.round((rank / order.length) * 150);
	});
	return appear;
})();

const SIGNAL_RNG = createRng(FILM_SPEC.seed, 'c003:signals');
const EDGE_SIGNAL_PHASE: readonly number[] = PERIPHERY.edges.map(() => SIGNAL_RNG());
const LINK_SIGNAL_PHASE: readonly number[] = PERIPHERY.nodes.map(() => SIGNAL_RNG());
const SIGNAL_PERIOD_SECONDS = 1.6;

export const NODE_FADE_FRAMES = 20;
export const EDGE_GROW_FRAMES = 16;

// ── state ─────────────────────────────────────────────────────────────────

export type AnchorRender = {
	readonly id: AnchorId;
	readonly s: number;
	readonly world: Vec3;
	readonly visibility: number;
	/** Raw P-protocol pulse intensity from the kernel. */
	readonly pulse: number;
	/** Final brightness used by the renderer. */
	readonly brightness: number;
	/** ACT IV identity trail: Φ(t−k·Δ)(K(s)), newest first. */
	readonly trail: readonly Vec3[];
};

export type ArcRender = {
	readonly from: AnchorId;
	readonly s0: number;
	/** Arc length in curve parameter units (0 .. 1/3). */
	readonly length: number;
	readonly reveal: number;
	/** Growth tip position (world). */
	readonly tip: Vec3;
};

export type LineRender = {readonly a: Vec3; readonly b: Vec3; readonly alpha: number};
export type PointRender = {readonly p: Vec3; readonly intensity: number};

export type FilmState = {
	readonly frame: number;
	readonly time: number;
	readonly camera: CameraState;
	readonly params: DeformationParams;
	readonly deformation: Deformation;
	readonly env: Envelopes;
	readonly anchors: readonly AnchorRender[];
	readonly arcs: readonly ArcRender[];
	readonly chords: readonly LineRender[];
	readonly peripheryNodes: readonly PointRender[];
	readonly peripheryEdges: readonly LineRender[];
	readonly coreLinks: readonly LineRender[];
	readonly signals: readonly PointRender[];
};

const TRAIL_SAMPLES = 20;
const TRAIL_STEP_FRAMES = 2;

const lerpVec = (a: Vec3, b: Vec3, t: number): Vec3 => [lerpN(a[0], b[0], t), lerpN(a[1], b[1], t), lerpN(a[2], b[2], t)];

export const filmStateAt = (frame: number, spec: MiIdentitySpec = FILM_SPEC): FilmState => {
	const time = frame / FILM.fps;
	const env = envelopesAt(frame);
	const params = filmDeformationParams(frame, spec);
	const deformation = deformationFromParams(spec, params);
	const reveal = arcRevealAt(frame);

	// Anchors: identity from the kernel, brightness from P + presentation envelopes.
	const anchors = anchorStates(spec, deformation).map((a): AnchorRender => {
		const pulse = pulseIntensity(spec, a.id, time);
		const visibility = env.anchorVisibility[a.id];
		const resonance = env.resonance * (0.75 + 0.25 * Math.cos((2 * Math.PI * time) / spec.pulse.periodSeconds));
		const trail =
			env.trails > 0
				? Array.from({length: TRAIL_SAMPLES}, (_, k) =>
						applyDeformation(filmDeformation(Math.max(0, frame - (k + 1) * TRAIL_STEP_FRAMES), spec), a.local),
					)
				: [];
		return {
			id: a.id,
			s: a.s,
			world: a.world,
			visibility,
			pulse,
			brightness: visibility * (0.55 + 0.9 * env.pulseGain * pulse + 0.6 * resonance),
			trail,
		};
	});

	const arcs = spec.anchors.map((a, i): ArcRender => {
		const length = reveal[i] / 3;
		return {
			from: a.id,
			s0: a.s,
			length,
			reveal: reveal[i],
			tip: applyDeformation(deformation, knotPoint(spec.knot, a.s + length)),
		};
	});

	const byId = Object.fromEntries(anchors.map((a) => [a.id, a])) as Record<AnchorId, AnchorRender>;
	const chords = spec.graph.edges.map(
		(e): LineRender => ({
			a: byId[e.from].world,
			b: byId[e.to].world,
			alpha: env.chords * Math.min(byId[e.from].visibility, byId[e.to].visibility),
		}),
	);

	const wobbleAmp = FILM_PERIPHERY_OPTIONS.wobbleAmplitude * Math.max(0, env.peripheryWobble);
	const localNodes = peripheryNodePositionsAt(PERIPHERY, time, wobbleAmp);
	const worldNodes = localNodes.map((v) => applyDeformation(deformation, v));
	const nodeVis = NODE_APPEAR.map((start) => smootherstep(start, start + NODE_FADE_FRAMES, frame));
	const op = Math.max(0, env.peripheryOpacity);

	const peripheryNodes = worldNodes.map((p, i): PointRender => ({p, intensity: op * nodeVis[i]}));

	const signals: PointRender[] = [];
	const sigEnv = Math.max(0, env.signals);
	const peripheryEdges = PERIPHERY.edges.map(([i, j], e): LineRender => {
		// Edge grows from the earlier node toward the later one.
		const [from, to] = NODE_APPEAR[i] <= NODE_APPEAR[j] ? [i, j] : [j, i];
		const startGrow = Math.max(NODE_APPEAR[i], NODE_APPEAR[j]) + 4;
		const grow = smootherstep(startGrow, startGrow + EDGE_GROW_FRAMES, frame);
		const a = worldNodes[from];
		const b = lerpVec(a, worldNodes[to], grow);
		if (sigEnv > 0 && grow >= 1) {
			const u = (((time / SIGNAL_PERIOD_SECONDS + EDGE_SIGNAL_PHASE[e]) % 1) + 1) % 1;
			signals.push({p: lerpVec(a, worldNodes[to], u), intensity: sigEnv * op * Math.sin(Math.PI * u) ** 2});
		}
		return {a, b, alpha: op * grow * 0.55};
	});

	const coreLinks = PERIPHERY.nodes.map((n, i): LineRender => {
		const root = applyDeformation(deformation, knotPoint(spec.knot, n.rootS));
		if (sigEnv > 0 && nodeVis[i] >= 1) {
			// Information flows inward, from the periphery to the core.
			const u = (((time / SIGNAL_PERIOD_SECONDS + LINK_SIGNAL_PHASE[i]) % 1) + 1) % 1;
			signals.push({p: lerpVec(worldNodes[i], root, u), intensity: 0.8 * sigEnv * op * Math.sin(Math.PI * u) ** 2});
		}
		return {a: worldNodes[i], b: root, alpha: op * nodeVis[i] * 0.22};
	});

	return {
		frame,
		time,
		camera: cameraAt(frame),
		params,
		deformation,
		env,
		anchors,
		arcs,
		chords,
		peripheryNodes,
		peripheryEdges,
		coreLinks,
		signals,
	};
};

/** Disc particles of the periphery (seeded, local frame). */
export const FILM_DISC_PARTICLES: Float32Array = PERIPHERY.particles;
export const FILM_PERIPHERY = PERIPHERY;
