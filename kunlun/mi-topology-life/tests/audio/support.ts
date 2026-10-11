import {SAMPLE_RATE} from '../../src/audio/constants';

/** Goertzel magnitude of `x` at `freq` over [start, start + len). */
export const goertzel = (x: Float64Array, start: number, len: number, freq: number): number => {
	const w = (2 * Math.PI * freq) / SAMPLE_RATE;
	const c = 2 * Math.cos(w);
	let s1 = 0;
	let s2 = 0;
	for (let n = 0; n < len; n++) {
		const s0 = x[start + n] + c * s1 - s2;
		s2 = s1;
		s1 = s0;
	}
	return Math.sqrt(s1 * s1 + s2 * s2 - c * s1 * s2) / len;
};

/**
 * Pulse centre time (s) at `freq` within [t0, t1]: energy centroid of a
 * Goertzel envelope using an integer number of cycles (≈ 20 ms) per window,
 * 2 ms hop. For a symmetric pulse the centroid is exactly the peak; unlike an
 * argmax it is not disturbed by window ripple on the flat top.
 */
export const envelopePeakTime = (x: Float64Array, freq: number, t0: number, t1: number): number => {
	const win = Math.round(Math.round(0.02 * freq) * (SAMPLE_RATE / freq));
	const hop = Math.round(0.002 * SAMPLE_RATE);
	let num = 0;
	let den = 0;
	for (let n = Math.round(t0 * SAMPLE_RATE); n + win < Math.round(t1 * SAMPLE_RATE); n += hop) {
		const e = goertzel(x, n, win, freq) ** 2;
		num += e * ((n + win / 2) / SAMPLE_RATE);
		den += e;
	}
	return num / den;
};
