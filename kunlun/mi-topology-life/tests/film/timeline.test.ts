import {describe, expect, it} from 'vitest';
import {FILM, FILM_DURATION_IN_FRAMES} from '../../src/config/film';
import {type Act, ACTS, actAt, TRANSITIONS, validateTimeline} from '../../src/film/timeline';

describe('C003.1 timeline', () => {
	it('total frame count is exactly 900 (30 s × 30 fps)', () => {
		expect(FILM_DURATION_IN_FRAMES).toBe(900);
		expect(FILM.fps * FILM.durationInSeconds).toBe(900);
		expect(ACTS.reduce((n, a) => n + a.end - a.start + 1, 0)).toBe(900);
	});

	it('acts match the shot plan exactly', () => {
		expect(ACTS.map((a) => [a.id, a.name, a.start, a.end])).toEqual([
			['I', '未分', 0, 149],
			['II', '破缺', 150, 329],
			['III', '织生', 330, 539],
			['IV', '易形', 540, 749],
			['V', '自见', 750, 899],
		]);
	});

	it('every frame belongs to exactly one act (no gaps, no overlaps)', () => {
		expect(validateTimeline(ACTS)).toEqual([]);
		for (let f = 0; f < FILM_DURATION_IN_FRAMES; f++) {
			expect(ACTS.filter((a) => f >= a.start && f <= a.end)).toHaveLength(1);
			expect(actAt(f).act.start).toBeLessThanOrEqual(f);
		}
		expect(() => actAt(-1)).toThrow();
		expect(() => actAt(900)).toThrow();
		expect(() => actAt(1.5)).toThrow();
	});

	it('validator detects gaps, overlaps and short coverage', () => {
		const clone = (): Act[] => ACTS.map((a) => ({...a}));
		const gap = clone();
		gap[1] = {...gap[1], start: 151};
		const overlap = clone();
		overlap[2] = {...overlap[2], start: 329};
		const short = clone();
		short[4] = {...short[4], end: 898};
		expect(validateTimeline(gap).join()).toMatch(/gap\/overlap/);
		expect(validateTimeline(overlap).join()).toMatch(/gap\/overlap/);
		expect(validateTimeline(short).join()).toMatch(/ends at 898/);
	});

	it('transition table: one per boundary, all continuous (no hard cuts)', () => {
		expect(TRANSITIONS.map((t) => t.frame)).toEqual(ACTS.slice(1).map((a) => a.start));
		expect(TRANSITIONS.every((t) => t.type === 'continuous')).toBe(true);
	});

	it('representative frames lie inside their acts', () => {
		for (const a of ACTS) expect(actAt(a.representative).act.id).toBe(a.id);
	});
});
