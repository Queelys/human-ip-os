import {describe, expect, it} from 'vitest';
import {createRng, deriveSeed, mulberry32} from '../src/core/rng';

describe('seeded rng', () => {
	it('produces an identical stream for the same seed', () => {
		const a = mulberry32(1234);
		const b = mulberry32(1234);
		const sa = Array.from({length: 100}, a);
		const sb = Array.from({length: 100}, b);
		expect(sa).toEqual(sb);
		expect(sa.every((x) => x >= 0 && x < 1)).toBe(true);
	});

	it('locks the first values of the stream (regression guard)', () => {
		const r = mulberry32(42);
		expect([r(), r(), r()].map((x) => x.toFixed(10))).toMatchInlineSnapshot(`
			[
			  "0.6011037519",
			  "0.4482905590",
			  "0.8524657935",
			]
		`);
	});

	it('derives independent sub-streams per label', () => {
		expect(deriveSeed(1, 'a')).not.toBe(deriveSeed(1, 'b'));
		expect(createRng(7, 'x')()).toBe(createRng(7, 'x')());
		expect(createRng(7, 'x')()).not.toBe(createRng(7, 'y')());
	});
});
