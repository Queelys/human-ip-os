import {createHash} from 'node:crypto';
import {beforeAll, describe, expect, it} from 'vitest';
import {SAMPLE_RATE, TOTAL_SAMPLES} from '../../src/audio/constants';
import {buildControlTable, type ControlTable, ctl} from '../../src/audio/control';
import {audioIdentityFromSpec, PULSE_BASE_HZ, pulsePeakTimes} from '../../src/audio/identity';
import {conditionStem, stats, sumStereo} from '../../src/audio/mix';
import {
	BODY_BASE_HZ,
	BODY_HARMONICS,
	FINALE_BASE_HZ,
	FINALE_RATIOS,
	RESONANCE_BASE_HZ,
	renderBody,
	renderFinale,
	renderGrains,
	renderPulse,
	renderResonance,
	resonanceRatios,
	type Stereo,
} from '../../src/audio/tracks';
import {encodeWav} from '../../src/audio/wav';
import {envelopesAt, FILM_SPEC} from '../../src/film/choreography';
import {DEFAULT_MI_SPEC, identityFingerprint, type MiIdentitySpec} from '../../src/identity/miKernel';
import {pulseIntensity} from '../../src/motion/pulse';
import {envelopePeakTime} from './support';

const spec = FILM_SPEC;
let ctlT: ControlTable;
let stems: Record<string, Stereo>;
const hash = (s: Stereo) => createHash('sha256').update(encodeWav(s, 'float32')).digest('hex');

beforeAll(() => {
	ctlT = buildControlTable();
	stems = {
		body: conditionStem(renderBody(ctlT)),
		pulse: conditionStem(renderPulse(spec, ctlT)),
		grains: conditionStem(renderGrains(spec, ctlT)),
		resonance: conditionStem(renderResonance(spec, ctlT)),
		finale: conditionStem(renderFinale(spec, ctlT)),
	};
}, 120_000);

describe('C004.1 sound identity mapping reads C002', () => {
	it('uses the C002 spec object, unchanged', () => {
		expect(spec).toBe(DEFAULT_MI_SPEC);
		expect(identityFingerprint(spec)).toBe('cd2e236379d37be5');
	});

	it('ids, phase offsets, pulse rate and seed come from the spec', () => {
		const a = audioIdentityFromSpec(spec);
		expect(a.voices.map((v) => v.id)).toEqual(spec.anchors.map((x) => x.id));
		expect(a.voices.map((v) => v.phaseOffset)).toEqual([...spec.pulse.phaseOffsets]);
		expect(a.pulsePeriodSeconds).toBe(spec.pulse.periodSeconds);
		expect(a.pulseRateHz).toBeCloseTo(1 / 3, 15);
		expect(a.seed).toBe(spec.seed);
		expect(a.voices.map((v) => v.pitchHz)).toEqual([PULSE_BASE_HZ, PULSE_BASE_HZ * 1.5, PULSE_BASE_HZ * 2]);
	});

	it('follows the spec rather than hard-coding a protocol', () => {
		const other: MiIdentitySpec = {...spec, pulse: {...spec.pulse, periodSeconds: 4, phaseOffsets: [0.1, 0.5, 0.8]}};
		const a = audioIdentityFromSpec(other);
		expect(a.voices.map((v) => v.phaseOffset)).toEqual([0.1, 0.5, 0.8]);
		expect(a.pulseRateHz).toBe(0.25);
		expect(pulsePeakTimes(other, 0, 30)[0]).toBeCloseTo((0.1 + other.pulse.width / 2) * 4, 12);
	});

	it('no sustained partial collides with an identity-pulse pitch (or its 3rd harmonic)', () => {
		const pulses = audioIdentityFromSpec(spec).voices.flatMap((v) => [v.pitchHz, 3 * v.pitchHz]);
		// Body drone bends by ±3 % with Φ twist; finale R channel is detuned by 0.15 %.
		const sustained = [
			...BODY_HARMONICS.map((h) => ({f: BODY_BASE_HZ * h, spread: 0.03})),
			...resonanceRatios(spec).map((r) => ({f: RESONANCE_BASE_HZ * r, spread: 0})),
			...FINALE_RATIOS.map((r) => ({f: FINALE_BASE_HZ * r, spread: 0.0015})),
		];
		for (const p of pulses) {
			for (const x of sustained) {
				// Keep ≥ 25 Hz clear of the 20 ms analysis band around each pulse pitch.
				expect(Math.abs(p - x.f) - x.f * x.spread, `${x.f} Hz vs pulse ${p} Hz`).toBeGreaterThan(25);
			}
		}
	});

	it('pulse peak times are exactly where the C002 pulse reaches 1', () => {
		for (let i = 0; i < 3; i++) {
			for (const t of pulsePeakTimes(spec, i, 30)) {
				expect(pulseIntensity(spec, spec.anchors[i].id, t)).toBeCloseTo(1, 9);
			}
		}
	});
});

describe('C004.3 audio follows the global timeline', () => {
	it('control signals equal the C003 envelopes at the same global time', () => {
		for (const t of [0, 3.37, 5, 11, 18, 25, 28.4, 29.99]) {
			const n = Math.round(t * SAMPLE_RATE / 48) * 48;
			const e = envelopesAt((n / SAMPLE_RATE) * 30);
			expect(ctl(ctlT, 'background', n)).toBeCloseTo(e.background, 12);
			expect(ctl(ctlT, 'resonance', n)).toBeCloseTo(e.resonance, 12);
			expect(ctl(ctlT, 'visA2', n)).toBeCloseTo(e.anchorVisibility.A2, 12);
		}
	});

	it('identity pulses peak on the P-protocol times: ±5 ms where envelopes are flat, ±1 frame everywhere audible', () => {
		const a = audioIdentityFromSpec(spec);
		const mono = stems.pulse.L.map((v, n) => v + stems.pulse.R[n]);
		const visKey = ['visA1', 'visA2', 'visA3'] as const;
		const strict: number[] = [];
		const all: number[] = [];
		a.voices.forEach((v, i) => {
			for (const t of pulsePeakTimes(spec, i, 30)) {
				const n = Math.round(t * SAMPLE_RATE);
				const vis = ctl(ctlT, visKey[i], n);
				if (vis < 0.2 || t < 0.5 || t > 29.4) continue;
				const err = Math.abs(envelopePeakTime(mono, v.pitchHz, t - 0.45, t + 0.45) - t);
				all.push(err);
				// Flat envelopes: visibility and gain constant across the pulse.
				const flat = [-0.4, 0.4].every((d) => {
					const m = Math.round((t + d) * SAMPLE_RATE);
					return Math.abs(ctl(ctlT, visKey[i], m) - vis) < 1e-6 && Math.abs(ctl(ctlT, 'pulseGain', m) - ctl(ctlT, 'pulseGain', n)) < 1e-6;
				});
				if (flat) strict.push(err);
			}
		});
		expect(all.length).toBeGreaterThanOrEqual(20);
		expect(strict.length).toBeGreaterThanOrEqual(15);
		expect(Math.max(...strict)).toBeLessThan(0.005);
		expect(Math.max(...all)).toBeLessThan(1 / 30);
	});
});

describe('C004.4 sample hygiene and determinism', () => {
	it('all stems: no NaN/Infinity, no DC, click-free edges', () => {
		for (const [name, s] of Object.entries(stems)) {
			const st = stats(s);
			expect(st.nonFinite, name).toBe(0);
			expect(Math.abs(st.dcL), name).toBeLessThan(1e-4);
			expect(Math.abs(st.dcR), name).toBeLessThan(1e-4);
			expect(st.first.map(Math.abs), name).toEqual([0, 0]);
			expect(st.last.map(Math.abs), name).toEqual([0, 0]);
			expect(s.L.length).toBe(TOTAL_SAMPLES);
		}
	});

	it('every stem is audible in its designed window (no dead track)', () => {
		const windows: Record<string, [number, number]> = {body: [2, 29], pulse: [3.2, 3.6], grains: [14, 24], resonance: [8, 28], finale: [27, 29]};
		for (const [name, [t0, t1]] of Object.entries(windows)) {
			const s = stems[name];
			let sq = 0;
			const a = Math.round(t0 * SAMPLE_RATE);
			const b = Math.round(t1 * SAMPLE_RATE);
			for (let n = a; n < b; n++) sq += s.L[n] ** 2 + s.R[n] ** 2;
			const rmsDb = 10 * Math.log10(sq / (2 * (b - a)));
			expect(rmsDb, name).toBeGreaterThan(-50);
		}
	});

	it('identical output for a fixed seed (re-render every track)', () => {
		const again = sumStereo([
			conditionStem(renderBody(ctlT)),
			conditionStem(renderPulse(spec, ctlT)),
			conditionStem(renderGrains(spec, ctlT)),
			conditionStem(renderResonance(spec, ctlT)),
			conditionStem(renderFinale(spec, ctlT)),
		]);
		expect(hash(again)).toBe(hash(sumStereo(Object.values(stems))));
	});

	it('grain layer depends on the seed (different seed → different grains)', () => {
		const other = conditionStem(renderGrains({...spec, seed: 1}, ctlT));
		expect(hash(other)).not.toBe(hash(stems.grains));
	});
});
