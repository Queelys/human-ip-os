/**
 * C003.6 caption: text, timing, typography and safe-area layout constants.
 * The caption font is an embedded Noto Serif SC subset (SIL OFL 1.1) so the
 * render never depends on system fonts.
 */
import {FILM} from '../config/film';
import {CAPTION_START_FRAME} from './choreography';

export const CAPTION_TEXT = '你看见了我，还是我生成了你？';
export const CAPTION_FONT_FAMILY = 'MiCaption';
export const CAPTION_FONT_FILE = 'fonts/NotoSerifSC-Medium-caption.ttf';
export const CAPTION_START = CAPTION_START_FRAME; // 28.0 s
export const CAPTION_END = 899; // last frame, inclusive (29.967 s)

/** Title-safe area: 90 % of the frame (5 % margin on each side). */
export const TITLE_SAFE = {
	left: Math.round(FILM.width * 0.05),
	top: Math.round(FILM.height * 0.05),
	right: Math.round(FILM.width * 0.95),
	bottom: Math.round(FILM.height * 0.95),
} as const;

export const CAPTION_LAYOUT = {
	fontSizePx: 54,
	letterSpacingEm: 0.12,
	/** Distance of the text block's bottom edge from the frame bottom. */
	bottomPx: 150,
	maxWidthPx: TITLE_SAFE.right - TITLE_SAFE.left,
	color: '#e6eeff',
} as const;
