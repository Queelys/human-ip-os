/**
 * C004.2 the five audio tracks. Each is a deterministic offline generator
 * returning a stereo buffer for the whole 30 s at 48 kHz. Randomness only via
 * createRng(spec.seed, label).
 */
import {createRng} from '../core/rng';
import {smootherstep} from '../film/easing';
import type {MiIdentitySpec} from '../identity/miKernel';
import {pulseIntensity} from '../motion/pulse';
import {SAMPLE_RATE, TOTAL_SAMPLES} from './constants';
import {type ControlTable, ctl} from './control';
import {audioIdentityFromSpec} from './identity';

export type Stereo = {readonly L: Float64Array; readonly R: Float64Array};

const TAU = Math.PI * 2;
const newStereo = (): Stereo => ({L: new Float64Array(TOTAL_SAMPLES), R: new Float64Array(TOTAL_SAMPLES)});

/** Equal-power pan gains for pan ∈ [−1, 1]. */
export const panGains = (pan: number): [number, number] => {
	const a = ((pan + 1) * Math.PI) / 4;
	return [Math.cos(a), Math.sin(a)];
};

/** Designed head fade-in and tail fade-out shared by sustained tracks (seconds). */
const headTail = (t: number, head: number, tailStart: number, end: number) =>
	smootherstep(0, head, t) * (1 - smootherstep(tailStart, end, t));

export const BODY_BASE_HZ = 55;
export const BODY_HARMONICS = [1, 2, 3] as const;
export const RESONANCE_BASE_HZ = 110;
/** 110 Hz × {1, q/p, p, q} from the knot winding numbers. */
export const resonanceRatios = (spec: MiIdentitySpec): readonly number[] => [1, spec.knot.q / spec.knot.p, spec.knot.p, spec.knot.q];
export const FINALE_BASE_HZ = 220;
export const FINALE_RATIOS = [1, 4 / 3, 3 / 2, 2, 9 / 4] as const;

export type TrackId = 'body' | 'pulse' | 'grains' | 'resonance' | 'finale';

export const TRACKS: readonly {id: TrackId; index: number; name: string; nameZh: string}[] = [
	{id: 'body', index: 1, name: 'Body Low', nameZh: '本体低频'},
	{id: 'pulse', index: 2, name: 'Identity Pulse', nameZh: '身份脉冲'},
	{id: 'grains', index: 3, name: 'Neural Grains', nameZh: '神经颗粒'},
	{id: 'resonance', index: 4, name: 'Topological Resonance', nameZh: '拓扑共振'},
	{id: 'finale', index: 5, name: 'Finale Harmony', nameZh: '终章和声'},
];

/** 1 · 本体低频: 55 Hz body drone; level follows the background envelope, pitch bends with Φ twist. */
export const renderBody = (ctlT: ControlTable): Stereo => {
	const out = newStereo();
	let phL = 0;
	let phR = 0;
	for (let n = 0; n < TOTAL_SAMPLES; n++) {
		const t = n / SAMPLE_RATE;
		const bg = ctl(ctlT, 'background', n);
		const amp = 0.42 * bg ** 1.2 * ctl(ctlT, 'scale', n) * headTail(t, 2.5, 29.0, 30.0) * (0.92 + 0.08 * Math.sin(TAU * 0.11 * t));
		const f = BODY_BASE_HZ * (1 + 0.03 * ctl(ctlT, 'twist', n));
		phL += (TAU * f) / SAMPLE_RATE;
		phR += (TAU * f * 1.0027) / SAMPLE_RATE;
		out.L[n] = amp * (Math.sin(phL) + 0.35 * Math.sin(2 * phL) + 0.12 * Math.sin(3 * phL));
		out.R[n] = amp * (Math.sin(phR) + 0.35 * Math.sin(2 * phR) + 0.12 * Math.sin(3 * phR));
	}
	return out;
};

/**
 * 2 · 身份脉冲: one voice per anchor. Envelope = C002 pulseIntensity(spec, id, t)
 * × the same visibility and pulse-gain envelopes that drive the anchor glow.
 */
export const renderPulse = (spec: MiIdentitySpec, ctlT: ControlTable): Stereo => {
	const out = newStereo();
	const id = audioIdentityFromSpec(spec);
	const vis = ['visA1', 'visA2', 'visA3'] as const;
	id.voices.forEach((v, i) => {
		const [gL, gR] = panGains(v.pan);
		for (let n = 0; n < TOTAL_SAMPLES; n++) {
			const t = n / SAMPLE_RATE;
			const env = pulseIntensity(spec, v.id, t) * ctl(ctlT, vis[i], n) * ctl(ctlT, 'pulseGain', n);
			if (env === 0) continue;
			// Phase-locked odd harmonic only: no beating (which would shift the
			// perceived peak off the P time) and no collision with another
			// anchor's fundamental (ratios 1 : 3/2 : 2).
			const s = 0.36 * env * (Math.sin(TAU * v.pitchHz * t) + 0.2 * Math.sin(3 * TAU * v.pitchHz * t));
			out.L[n] += gL * s;
			out.R[n] += gR * s;
		}
	});
	return out;
};

/**
 * 3 · 神经颗粒: short Hann-windowed sine grains. Candidate onsets come from a
 * seeded Poisson process; each is kept with probability = the visual signal
 * envelope × network opacity, so grain density follows the information flow
 * on screen. Every candidate consumes the same number of RNG draws.
 */
export const renderGrains = (spec: MiIdentitySpec, ctlT: ControlTable): Stereo => {
	const out = newStereo();
	const rng = createRng(spec.seed, 'c004:grains');
	const RATE = 70;
	let t = 0;
	for (;;) {
		t += -Math.log(1 - rng()) / RATE;
		const uKeep = rng();
		const dur = 0.008 + 0.022 * rng();
		const freq = 1800 + 3400 * rng();
		const amp = 0.05 + 0.06 * rng();
		const pan = -0.9 + 1.8 * rng();
		if (t >= 29.5) break;
		const n0 = Math.round(t * SAMPLE_RATE);
		const density = ctl(ctlT, 'signals', n0) * ctl(ctlT, 'periphery', n0);
		if (uKeep >= density) continue;
		const len = Math.round(dur * SAMPLE_RATE);
		const [gL, gR] = panGains(pan);
		for (let k = 0; k < len && n0 + k < TOTAL_SAMPLES; k++) {
			const w = 0.5 - 0.5 * Math.cos((TAU * k) / (len - 1));
			const s = amp * w * Math.sin((TAU * freq * k) / SAMPLE_RATE);
			out.L[n0 + k] += gL * s;
			out.R[n0 + k] += gR * s;
		}
	}
	return out;
};

/**
 * 4 · 拓扑共振: partials on ratios built from the knot's (p, q) = (2, 3):
 * 110 Hz × {1, q/p, p, q}. Level follows how much of K is revealed and the
 * core glow; the Φ twist adds a shimmer (amplitude modulation).
 */
export const renderResonance = (spec: MiIdentitySpec, ctlT: ControlTable): Stereo => {
	const out = newStereo();
	const ratios = resonanceRatios(spec);
	const partials = [
		{r: ratios[0], w: 1, pan: -0.3},
		{r: ratios[1], w: 0.6, pan: 0.3},
		{r: ratios[2], w: 0.45, pan: -0.5},
		{r: ratios[3], w: 0.25, pan: 0.5},
	].map((x) => ({...x, g: panGains(x.pan)}));
	let amPhase = 0;
	for (let n = 0; n < TOTAL_SAMPLES; n++) {
		const t = n / SAMPLE_RATE;
		const tw = Math.abs(ctl(ctlT, 'twist', n));
		amPhase += (TAU * (0.5 + 3 * tw)) / SAMPLE_RATE;
		const am = 1 - 0.35 * tw * (0.5 + 0.5 * Math.sin(amPhase));
		const amp = 0.16 * ctl(ctlT, 'reveal', n) * (0.6 + 0.4 * Math.min(1, ctl(ctlT, 'coreGlow', n))) * am * headTail(t, 0.5, 29.0, 30.0);
		if (amp === 0) continue;
		for (const x of partials) {
			const s = amp * x.w * Math.sin(TAU * RESONANCE_BASE_HZ * x.r * t);
			out.L[n] += x.g[0] * s;
			out.R[n] += x.g[1] * s;
		}
	}
	return out;
};

/**
 * 5 · 终章和声: an open chord 220 Hz × {1, 4/3, 3/2, 2, 9/4} (ratios built only
 * from the primes 2 and 3, i.e. p and q). The ratio 3 (660 Hz) is excluded
 * because it would coincide with A1's identity-pulse pitch. It swells with the
 * ACT V shared resonance and breathes with the same 0.75 + 0.25·cos(2πt/T)
 * term as the synchronised anchor glow.
 */
export const renderFinale = (spec: MiIdentitySpec, ctlT: ControlTable): Stereo => {
	const out = newStereo();
	const T = spec.pulse.periodSeconds;
	const chord = FINALE_RATIOS.map((r, i) => ({r, w: [1, 0.45, 0.7, 0.55, 0.35][i]}));
	for (let n = 0; n < TOTAL_SAMPLES; n++) {
		const t = n / SAMPLE_RATE;
		const res = ctl(ctlT, 'resonance', n);
		if (res === 0) continue;
		const amp = 0.12 * res * (0.75 + 0.25 * Math.cos((TAU * t) / T)) * headTail(t, 0.5, 29.0, 30.0);
		let l = 0;
		let r = 0;
		for (const c of chord) {
			l += c.w * Math.sin(TAU * FINALE_BASE_HZ * c.r * t);
			r += c.w * Math.sin(TAU * FINALE_BASE_HZ * c.r * 1.0015 * t);
		}
		out.L[n] = amp * l;
		out.R[n] = amp * r;
	}
	return out;
};
