/**
 * C003.6 caption font and layout. Parses the embedded TrueType font's cmap
 * to prove every caption code point has a glyph (no tofu), and checks the
 * typographic block fits inside the title-safe area.
 */
import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {FILM} from '../../src/config/film';
import {CAPTION_FONT_FILE, CAPTION_LAYOUT, CAPTION_TEXT, TITLE_SAFE} from '../../src/film/caption';

/** Minimal sfnt cmap reader (formats 4 and 12) → set of mapped code points. */
const cmapCodePoints = (buf: Buffer): Set<number> => {
	const numTables = buf.readUInt16BE(4);
	let cmap = -1;
	for (let i = 0; i < numTables; i++) {
		const rec = 12 + i * 16;
		if (buf.toString('latin1', rec, rec + 4) === 'cmap') cmap = buf.readUInt32BE(rec + 8);
	}
	if (cmap < 0) throw new Error('no cmap table');
	const out = new Set<number>();
	const n = buf.readUInt16BE(cmap + 2);
	for (let i = 0; i < n; i++) {
		const off = cmap + buf.readUInt32BE(cmap + 4 + i * 8 + 4);
		const format = buf.readUInt16BE(off);
		if (format === 4) {
			const segX2 = buf.readUInt16BE(off + 6);
			const ends = off + 14;
			const starts = ends + segX2 + 2;
			const deltas = starts + segX2;
			const ranges = deltas + segX2;
			for (let s = 0; s < segX2 / 2; s++) {
				const end = buf.readUInt16BE(ends + s * 2);
				const start = buf.readUInt16BE(starts + s * 2);
				const delta = buf.readInt16BE(deltas + s * 2);
				const rangeOff = buf.readUInt16BE(ranges + s * 2);
				for (let c = start; c <= end && c !== 0xffff; c++) {
					let glyph: number;
					if (rangeOff === 0) glyph = (c + delta) & 0xffff;
					else {
						const g = buf.readUInt16BE(ranges + s * 2 + rangeOff + (c - start) * 2);
						glyph = g === 0 ? 0 : (g + delta) & 0xffff;
					}
					if (glyph !== 0) out.add(c);
				}
			}
		} else if (format === 12) {
			const groups = buf.readUInt32BE(off + 12);
			for (let g = 0; g < groups; g++) {
				const start = buf.readUInt32BE(off + 16 + g * 12);
				const end = buf.readUInt32BE(off + 20 + g * 12);
				const glyph = buf.readUInt32BE(off + 24 + g * 12);
				for (let c = start; c <= end; c++) if (glyph + (c - start) !== 0) out.add(c);
			}
		}
	}
	return out;
};

describe('C003.6 caption', () => {
	it('text is exactly the required line', () => {
		expect(CAPTION_TEXT).toBe('你看见了我，还是我生成了你？');
	});

	it('embedded font covers every caption code point', () => {
		const font = readFileSync(`public/${CAPTION_FONT_FILE}`);
		expect(font.readUInt32BE(0)).toBe(0x00010000); // TrueType sfnt
		const cps = cmapCodePoints(font);
		const missing = [...CAPTION_TEXT].filter((ch) => !cps.has(ch.codePointAt(0)!));
		expect(missing).toEqual([]);
	});

	it('font licence ships with the font', () => {
		expect(readFileSync('public/fonts/OFL.txt', 'utf8')).toMatch(/SIL Open Font License/);
	});

	it('typographic block fits the title-safe area (upper bound on advance width)', () => {
		const chars = [...CAPTION_TEXT].length;
		// CJK glyphs advance ≤ 1 em; letter-spacing adds per character.
		const maxWidth = chars * CAPTION_LAYOUT.fontSizePx * (1 + CAPTION_LAYOUT.letterSpacingEm);
		expect(maxWidth).toBeLessThanOrEqual(TITLE_SAFE.right - TITLE_SAFE.left);
		const bottom = FILM.height - CAPTION_LAYOUT.bottomPx;
		const top = bottom - CAPTION_LAYOUT.fontSizePx * 1.5;
		expect(bottom).toBeLessThanOrEqual(TITLE_SAFE.bottom);
		expect(top).toBeGreaterThanOrEqual(TITLE_SAFE.top);
	});
});
