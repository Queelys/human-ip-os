/**
 * C003.5 transitions. All four act boundaries are continuous (no hard cuts);
 * this verifies continuity of position (anchors), pose (Φ parameters,
 * camera) and visual envelopes on every frame, with extra scrutiny at the
 * boundaries.
 */
import {mkdirSync, writeFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {FILM_DURATION_IN_FRAMES} from '../../src/config/film';
import {CAPTION_FADE_FRAMES, CAPTION_START_FRAME, envelopesAt, filmDeformationParams, filmStateAt} from '../../src/film/choreography';
import {TRANSITIONS} from '../../src/film/timeline';
import {distance} from '../../src/geometry/vec3';

const FRAMES = Array.from({length: FILM_DURATION_IN_FRAMES}, (_, f) => f);

/** Flatten envelopes into named scalar channels. */
const channels = (f: number): Record<string, number> => {
	const e = envelopesAt(f);
	const {anchorVisibility, ...rest} = e;
	return {...rest, visA1: anchorVisibility.A1, visA2: anchorVisibility.A2, visA3: anchorVisibility.A3};
};

/** Maximum per-frame change allowed for any envelope (≈ 12-frame minimum ramp). */
const MAX_ENVELOPE_STEP = 0.1;
const MAX_PARAM_STEP = 0.05;
const MAX_ANCHOR_STEP = 0.08;

describe('C003.5 continuous transitions', () => {
	it('visual envelopes never jump (all frames)', () => {
		const worst: Record<string, {step: number; frame: number}> = {};
		for (let f = 1; f < FILM_DURATION_IN_FRAMES; f++) {
			const a = channels(f - 1);
			const b = channels(f);
			for (const k of Object.keys(b)) {
				const step = Math.abs(b[k] - a[k]);
				if (!worst[k] || step > worst[k].step) worst[k] = {step, frame: f};
			}
		}
		mkdirSync('out/test-logs', {recursive: true});
		writeFileSync('out/test-logs/envelope-continuity.json', JSON.stringify({limit: MAX_ENVELOPE_STEP, worst}, null, 2));
		for (const [k, w] of Object.entries(worst)) expect(w.step, `${k} @ ${w.frame}`).toBeLessThanOrEqual(MAX_ENVELOPE_STEP);
	});

	it('Φ pose parameters never jump (all frames)', () => {
		for (let f = 1; f < FILM_DURATION_IN_FRAMES; f++) {
			const a = filmDeformationParams(f - 1);
			const b = filmDeformationParams(f);
			for (const k of Object.keys(a) as (keyof typeof a)[]) {
				expect(Math.abs(b[k] - a[k]), `${k} @ ${f}`).toBeLessThanOrEqual(MAX_PARAM_STEP);
			}
		}
	});

	it('anchor positions move continuously, including across act boundaries', () => {
		let prev = filmStateAt(0).anchors;
		let worst = 0;
		for (const f of FRAMES.slice(1)) {
			const cur = filmStateAt(f).anchors;
			cur.forEach((a, i) => (worst = Math.max(worst, distance(a.world, prev[i].world))));
			prev = cur;
		}
		expect(worst).toBeLessThanOrEqual(MAX_ANCHOR_STEP);
	});

	it('at each boundary the step equals the local trend (no discontinuity)', () => {
		for (const t of TRANSITIONS) {
			const b = t.frame;
			const step = (f: number) => {
				const x = channels(f);
				const y = channels(f - 1);
				return Math.max(...Object.keys(x).map((k) => Math.abs(x[k] - y[k])));
			};
			// The boundary step is no larger than the largest neighbouring step + tiny slack.
			expect(step(b)).toBeLessThanOrEqual(Math.max(step(b - 1), step(b + 1)) + 0.02);
		}
	});

	it('caption: absent before 28 s, fades in from frame 840, fully visible from 864 to the end', () => {
		for (const f of FRAMES) {
			const c = envelopesAt(f).caption;
			if (f <= CAPTION_START_FRAME) expect(c).toBe(0);
			else expect(c).toBeGreaterThan(0);
			if (f >= CAPTION_START_FRAME + CAPTION_FADE_FRAMES) expect(c).toBe(1);
		}
		expect(CAPTION_START_FRAME / 30).toBe(28);
	});
});
