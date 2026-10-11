/**
 * C003.1 global timeline: 900 frames, five acts, contiguous and disjoint.
 * Every transition between acts is continuous (no hard cuts); see
 * docs/C003_SHOT_LIST.md and tests/film/timeline.test.ts.
 */
import {FILM, FILM_DURATION_IN_FRAMES} from '../config/film';

export type ActId = 'I' | 'II' | 'III' | 'IV' | 'V';

export type Act = {
	readonly id: ActId;
	readonly name: string;
	readonly nameEn: string;
	/** First frame, inclusive. */
	readonly start: number;
	/** Last frame, inclusive. */
	readonly end: number;
	/** Representative frame for stills and the contact sheet. */
	readonly representative: number;
};

export const ACTS: readonly Act[] = Object.freeze([
	{id: 'I', name: '未分', nameEn: 'Undivided', start: 0, end: 149, representative: 101},
	{id: 'II', name: '破缺', nameEn: 'Symmetry Breaking', start: 150, end: 329, representative: 300},
	{id: 'III', name: '织生', nameEn: 'Weaving Life', start: 330, end: 539, representative: 480},
	{id: 'IV', name: '易形', nameEn: 'Transformation', start: 540, end: 749, representative: 690},
	{id: 'V', name: '自见', nameEn: 'Self-Seeing', start: 750, end: 899, representative: 885},
] as const satisfies readonly Act[]);

export type TransitionType = 'continuous' | 'hard-cut';

export type Transition = {
	readonly from: ActId;
	readonly to: ActId;
	/** First frame of the incoming act. */
	readonly frame: number;
	readonly type: TransitionType;
	readonly note: string;
};

/** Explicit transition table. There are no hard cuts in C003. */
export const TRANSITIONS: readonly Transition[] = Object.freeze([
	{from: 'I', to: 'II', frame: 150, type: 'continuous', note: '静止机位以零速度起推；A2/A3 渐显'},
	{from: 'II', to: 'III', frame: 330, type: 'continuous', note: '推进减速为零后接环绕；轨迹继续生长，外围网络渐生'},
	{from: 'III', to: 'IV', frame: 540, type: 'continuous', note: '环绕减速为零后接拉远；Φ 形变由零渐入'},
	{from: 'IV', to: 'V', frame: 750, type: 'continuous', note: '拉远减速为零后回正；Φ 渐回恒等，外围渐静'},
] as const satisfies readonly Transition[]);

export type ActPosition = {
	readonly act: Act;
	readonly index: number;
	/** Frame relative to the act start. */
	readonly local: number;
	/** 0 at the first frame of the act, 1 at the last. */
	readonly progress: number;
};

export const actAt = (frame: number): ActPosition => {
	if (!Number.isInteger(frame) || frame < 0 || frame >= FILM_DURATION_IN_FRAMES) {
		throw new Error(`frame ${frame} outside [0, ${FILM_DURATION_IN_FRAMES - 1}]`);
	}
	const index = ACTS.findIndex((a) => frame >= a.start && frame <= a.end);
	const act = ACTS[index];
	return {act, index, local: frame - act.start, progress: (frame - act.start) / (act.end - act.start)};
};

/** Structural check: contiguous, disjoint, covering exactly [0, total). */
export const validateTimeline = (acts: readonly Act[], total = FILM_DURATION_IN_FRAMES): string[] => {
	const errors: string[] = [];
	if (acts.length === 0) return ['no acts'];
	if (acts[0].start !== 0) errors.push(`first act starts at ${acts[0].start}, not 0`);
	if (acts[acts.length - 1].end !== total - 1) errors.push(`last act ends at ${acts[acts.length - 1].end}, not ${total - 1}`);
	acts.forEach((a, i) => {
		if (a.end < a.start) errors.push(`act ${a.id} is empty`);
		if (a.representative < a.start || a.representative > a.end) errors.push(`act ${a.id} representative outside act`);
		if (i > 0 && a.start !== acts[i - 1].end + 1) {
			errors.push(`gap/overlap between ${acts[i - 1].id} (end ${acts[i - 1].end}) and ${a.id} (start ${a.start})`);
		}
	});
	const covered = acts.reduce((n, a) => n + (a.end - a.start + 1), 0);
	if (covered !== total) errors.push(`acts cover ${covered} frames, expected ${total}`);
	return errors;
};

export const frameToSeconds = (frame: number): number => frame / FILM.fps;
