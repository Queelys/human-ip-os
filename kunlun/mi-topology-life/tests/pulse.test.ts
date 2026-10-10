import {describe, expect, it} from 'vitest';
import {FILM, FILM_DURATION_IN_FRAMES} from '../src/config/film';
import type {AnchorId} from '../src/identity/miKernel';
import {DEFAULT_MI_SPEC} from '../src/identity/miKernel';
import {pulseIntensities, pulseIntensity, pulsePhase, pulseWaveform} from '../src/motion/pulse';

const spec = DEFAULT_MI_SPEC;
const IDS: AnchorId[] = ['A1', 'A2', 'A3'];
const T = spec.pulse.periodSeconds;
const circDiff = (a: number, b: number) => {
	const d = a - b - Math.floor(a - b);
	return Math.min(d, 1 - d);
};

describe('C002.5 pulse protocol', () => {
	it('phase differences between anchors are fixed on every film frame', () => {
		for (let f = 0; f < FILM_DURATION_IN_FRAMES; f++) {
			const t = f / FILM.fps;
			const ph = IDS.map((id) => pulsePhase(spec, id, t));
			for (let i = 0; i < 3; i++) {
				const want = spec.pulse.phaseOffsets[i] - spec.pulse.phaseOffsets[0];
				// φ_A1 − φ_Ai ≡ offset_i (mod 1)
				expect(circDiff(ph[0] - ph[i], want)).toBeLessThan(1e-9);
			}
		}
	});

	it('is shift-equivariant: I_Ai(t) = I_A1(t − offset_i·T)', () => {
		for (let k = 0; k < 500; k++) {
			const t = k * 0.0731;
			for (let i = 0; i < 3; i++) {
				expect(pulseIntensity(spec, IDS[i], t)).toBeCloseTo(
					pulseIntensity(spec, 'A1', t - spec.pulse.phaseOffsets[i] * T),
					9,
				);
			}
		}
	});

	it('is periodic, bounded in [0, 1] and peaks at 1', () => {
		let peak = 0;
		for (let k = 0; k < 3000; k++) {
			const t = k * 0.001 * T;
			for (const id of IDS) {
				const v = pulseIntensity(spec, id, t);
				expect(v).toBeGreaterThanOrEqual(0);
				expect(v).toBeLessThanOrEqual(1);
				expect(pulseIntensity(spec, id, t + 7 * T)).toBeCloseTo(v, 9);
				peak = Math.max(peak, v);
			}
		}
		expect(peak).toBeCloseTo(1, 4);
		expect(pulseWaveform(spec.pulse.width / 2, spec.pulse.width)).toBeCloseTo(1, 12);
		expect(pulseWaveform(spec.pulse.width, spec.pulse.width)).toBe(0);
	});

	it('depends only on t — evaluation order does not matter', () => {
		const frames = [0, 899, 13, 450, 13, 0];
		const fwd = frames.map((f) => pulseIntensities(spec, f / FILM.fps));
		const rev = [...frames].reverse().map((f) => pulseIntensities(spec, f / FILM.fps)).reverse();
		expect(fwd).toEqual(rev);
	});

	it('default config: pulses never overlap (width ≤ smallest phase gap)', () => {
		for (let f = 0; f < FILM_DURATION_IN_FRAMES; f++) {
			const v = Object.values(pulseIntensities(spec, f / FILM.fps));
			expect(v.filter((x) => x > 0).length).toBeLessThanOrEqual(1);
		}
	});
});
