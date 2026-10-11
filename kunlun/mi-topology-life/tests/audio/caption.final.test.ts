import {describe, expect, it} from 'vitest';
import {FINAL_CAPTION_TIMING, finalCaptionOpacity} from '../../src/final/captionTiming';

const at = (seconds: number) => finalCaptionOpacity(seconds * 30);

describe('C004.5 final caption timing', () => {
	it('matches the approved keypoints', () => {
		expect(FINAL_CAPTION_TIMING).toEqual({fadeInStart: 28, fullyVisible: 28.5, fadeOutStart: 29.5, end: 30});
		expect(at(27.9)).toBe(0);
		expect(at(28.0)).toBe(0);
		expect(at(28.25)).toBeGreaterThan(0.3);
		expect(at(28.5)).toBe(1);
		expect(at(29.0)).toBe(1);
		expect(at(29.5)).toBe(1);
		expect(at(29.75)).toBeLessThan(0.7);
		expect(at(30.0)).toBe(0);
	});

	it('is zero before frame 841, rises monotonically, holds, then falls monotonically', () => {
		for (let f = 0; f <= 840; f++) expect(finalCaptionOpacity(f)).toBe(0);
		for (let f = 841; f <= 855; f++) expect(finalCaptionOpacity(f)).toBeGreaterThan(finalCaptionOpacity(f - 1));
		for (let f = 855; f <= 885; f++) expect(finalCaptionOpacity(f)).toBe(1);
		for (let f = 886; f <= 899; f++) expect(finalCaptionOpacity(f)).toBeLessThan(finalCaptionOpacity(f - 1));
	});
});
