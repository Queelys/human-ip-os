/** Mixing, DC blocking, edge fades, limiting and sample statistics. */
import {SAMPLE_RATE, TOTAL_SAMPLES} from './constants';
import type {Stereo} from './tracks';

export const HEAD_FADE_SAMPLES = Math.round(0.01 * SAMPLE_RATE); // 10 ms
export const TAIL_FADE_SAMPLES = Math.round(0.05 * SAMPLE_RATE); // 50 ms

/** 1-pole/1-zero DC blocker (≈ 5 Hz), applied identically to every stem. */
export const dcBlock = (x: Float64Array): Float64Array => {
	const R = 1 - (2 * Math.PI * 5) / SAMPLE_RATE;
	const y = new Float64Array(x.length);
	let xPrev = 0;
	let yPrev = 0;
	for (let n = 0; n < x.length; n++) {
		yPrev = x[n] - xPrev + R * yPrev;
		xPrev = x[n];
		y[n] = yPrev;
	}
	return y;
};

/** Click-free edges: raised-cosine fade over the first 10 ms and last 50 ms; first and last samples are exactly 0. */
export const edgeFade = (x: Float64Array): Float64Array => {
	const y = Float64Array.from(x);
	for (let n = 0; n < HEAD_FADE_SAMPLES; n++) y[n] *= 0.5 - 0.5 * Math.cos((Math.PI * n) / HEAD_FADE_SAMPLES);
	for (let k = 0; k < TAIL_FADE_SAMPLES; k++) {
		const n = x.length - 1 - k;
		y[n] *= 0.5 - 0.5 * Math.cos((Math.PI * k) / TAIL_FADE_SAMPLES);
	}
	return y;
};

export const conditionStem = (s: Stereo): Stereo => ({L: edgeFade(dcBlock(s.L)), R: edgeFade(dcBlock(s.R))});

export const sumStereo = (stems: readonly Stereo[]): Stereo => {
	const L = new Float64Array(TOTAL_SAMPLES);
	const R = new Float64Array(TOTAL_SAMPLES);
	for (const s of stems) {
		for (let n = 0; n < TOTAL_SAMPLES; n++) {
			L[n] += s.L[n];
			R[n] += s.R[n];
		}
	}
	return {L, R};
};

export const scaleStereo = (s: Stereo, gain: number): Stereo => ({L: s.L.map((v) => v * gain), R: s.R.map((v) => v * gain)});

export const dbToGain = (db: number): number => 10 ** (db / 20);

/**
 * Deterministic look-ahead peak limiter (stereo-linked). Gain never exceeds
 * 1, reaches the required reduction before each peak (5 ms look-ahead) and
 * recovers with an 80 ms release. Output sample peak ≤ ceiling.
 */
export const limit = (s: Stereo, ceilingDb: number): {out: Stereo; maxReductionDb: number} => {
	const c = dbToGain(ceilingDb);
	const N = s.L.length;
	const LA = Math.round(0.005 * SAMPLE_RATE);
	const need = new Float64Array(N);
	for (let n = 0; n < N; n++) {
		const pk = Math.max(Math.abs(s.L[n]), Math.abs(s.R[n]));
		need[n] = pk > c ? c / pk : 1;
	}
	// Moving minimum over [n, n + LA].
	const target = new Float64Array(N);
	const dq: number[] = [];
	for (let n = N - 1; n >= 0; n--) {
		while (dq.length && need[dq[dq.length - 1]] >= need[n]) dq.pop();
		dq.push(n);
		while (dq[0] > n + LA) dq.shift();
		target[n] = need[dq[0]];
	}
	const rel = Math.exp(-1 / (0.08 * SAMPLE_RATE));
	const L = new Float64Array(N);
	const R = new Float64Array(N);
	let g = 1;
	let minG = 1;
	for (let n = 0; n < N; n++) {
		g = target[n] < g ? target[n] : target[n] + (g - target[n]) * rel;
		g = Math.min(g, target[n]);
		minG = Math.min(minG, g);
		L[n] = s.L[n] * g;
		R[n] = s.R[n] * g;
	}
	return {out: {L, R}, maxReductionDb: 20 * Math.log10(minG)};
};

export type BufferStats = {
	readonly samples: number;
	readonly nonFinite: number;
	readonly peak: number;
	readonly peakDbfs: number;
	readonly rmsDbfs: number;
	readonly dcL: number;
	readonly dcR: number;
	readonly first: readonly [number, number];
	readonly last: readonly [number, number];
	/** Samples with |x| ≥ 0.999 (clipping risk). */
	readonly nearFullScale: number;
};

export const stats = (s: Stereo): BufferStats => {
	let nonFinite = 0;
	let peak = 0;
	let sq = 0;
	let sumL = 0;
	let sumR = 0;
	let nearFullScale = 0;
	for (let n = 0; n < s.L.length; n++) {
		for (const v of [s.L[n], s.R[n]]) {
			if (!Number.isFinite(v)) nonFinite++;
			const a = Math.abs(v);
			peak = Math.max(peak, a);
			sq += v * v;
			if (a >= 0.999) nearFullScale++;
		}
		sumL += s.L[n];
		sumR += s.R[n];
	}
	const N = s.L.length;
	return {
		samples: N,
		nonFinite,
		peak,
		peakDbfs: 20 * Math.log10(peak || 1e-12),
		rmsDbfs: 10 * Math.log10(sq / (2 * N) || 1e-24),
		dcL: sumL / N,
		dcR: sumR / N,
		first: [s.L[0], s.R[0]],
		last: [s.L[N - 1], s.R[N - 1]],
		nearFullScale,
	};
};
