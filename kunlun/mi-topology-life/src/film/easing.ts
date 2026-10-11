/** Closed-form easing helpers. All are pure functions of their inputs. */

export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Quintic smootherstep: 0 below e0, 1 above e1, with zero first and second
 * derivatives at both ends (C² continuous). Used for every animated quantity
 * so that act boundaries never introduce velocity or acceleration jumps.
 */
export const smootherstep = (e0: number, e1: number, x: number): number => {
	if (e1 <= e0) {
		throw new Error(`smootherstep: empty interval [${e0}, ${e1}]`);
	}
	const t = clamp((x - e0) / (e1 - e0), 0, 1);
	return t * t * t * (t * (t * 6 - 15) + 10);
};

/** Smoothly move from `from` to `to` while frame goes from `start` to `end`. */
export const ramp = (frame: number, start: number, end: number, from: number, to: number): number =>
	lerp(from, to, smootherstep(start, end, frame));

/** Sum of ramp increments: Σ smootherstep(s_k, e_k, f)·Δ_k. */
export const ramps = (frame: number, segments: readonly (readonly [number, number, number])[]): number =>
	segments.reduce((acc, [s, e, delta]) => acc + delta * smootherstep(s, e, frame), 0);
