import {describe, expect, it} from 'vitest';
import {frameToSeconds, loopPhase} from '../src/core/time';

describe('frame-driven time', () => {
	it('maps frames to seconds at 30 fps', () => {
		expect(frameToSeconds(0, 30)).toBe(0);
		expect(frameToSeconds(90, 30)).toBe(3);
	});

	it('loops exactly over the period, independent of evaluation order', () => {
		expect(loopPhase(0, 30, 3)).toBe(0);
		expect(loopPhase(45, 30, 3)).toBe(0.5);
		expect(loopPhase(90, 30, 3)).toBe(0);
		const forward = Array.from({length: 90}, (_, f) => loopPhase(f, 30, 3));
		const shuffled = [89, 3, 47, 0, 12].map((f) => loopPhase(f, 30, 3));
		expect(shuffled).toEqual([89, 3, 47, 0, 12].map((f) => forward[f]));
	});
});
