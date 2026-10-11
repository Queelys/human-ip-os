/**
 * Control signals for the audio engine, taken from the *same* functions that
 * drive the picture (C003 envelopes, Φ(t), arc reveal) on the same global
 * clock: frame = t · fps. Sampled every CONTROL_STEP samples (1 ms) and
 * linearly interpolated, so audio events land on the visual timeline.
 */
import {FILM} from '../config/film';
import {arcRevealAt, envelopesAt, FILM_SPEC, filmDeformationParams} from '../film/choreography';
import {CONTROL_STEP, SAMPLE_RATE, TOTAL_SAMPLES} from './constants';

export const CONTROL_CHANNELS = [
	'background',
	'visA1',
	'visA2',
	'visA3',
	'pulseGain',
	'resonance',
	'coreGlow',
	'signals',
	'periphery',
	'reveal',
	'twist',
	'scale',
] as const;
export type ControlChannel = (typeof CONTROL_CHANNELS)[number];

export type ControlTable = Record<ControlChannel, Float64Array>;

const controlValues = (t: number): Record<ControlChannel, number> => {
	const frame = t * FILM.fps;
	const e = envelopesAt(frame);
	const p = filmDeformationParams(frame);
	const r = arcRevealAt(frame);
	return {
		background: e.background,
		visA1: e.anchorVisibility.A1,
		visA2: e.anchorVisibility.A2,
		visA3: e.anchorVisibility.A3,
		pulseGain: e.pulseGain,
		resonance: e.resonance,
		coreGlow: e.coreGlow,
		signals: Math.max(0, e.signals),
		periphery: Math.max(0, e.peripheryOpacity),
		reveal: (r[0] + r[1] + r[2]) / 3,
		twist: p.twist / FILM_SPEC.deformation.twistRateMax,
		scale: p.scale,
	};
};

export const buildControlTable = (): ControlTable => {
	const n = Math.ceil(TOTAL_SAMPLES / CONTROL_STEP) + 2;
	const table = Object.fromEntries(CONTROL_CHANNELS.map((c) => [c, new Float64Array(n)])) as ControlTable;
	for (let k = 0; k < n; k++) {
		const v = controlValues((k * CONTROL_STEP) / SAMPLE_RATE);
		for (const c of CONTROL_CHANNELS) table[c][k] = v[c];
	}
	return table;
};

/** Linear interpolation of a control channel at sample n. */
export const ctl = (table: ControlTable, channel: ControlChannel, n: number): number => {
	const x = n / CONTROL_STEP;
	const k = Math.floor(x);
	const f = x - k;
	const a = table[channel];
	return a[k] + (a[k + 1] - a[k]) * f;
};
