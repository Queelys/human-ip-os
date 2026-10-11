/**
 * C004.5 final caption timing (approved copy, same text/font/layout as C003):
 *   28.0 s fade-in starts · 28.5 s fully visible · 29.5 s fade-out starts · 30.0 s end.
 * Evaluated at the frame's time t = frame / fps; quintic smootherstep fades.
 */
import {FILM} from '../config/film';
import {smootherstep} from '../film/easing';

export const FINAL_CAPTION_TIMING = {
	fadeInStart: 28.0,
	fullyVisible: 28.5,
	fadeOutStart: 29.5,
	end: 30.0,
} as const;

export const finalCaptionOpacity = (frame: number): number => {
	const t = frame / FILM.fps;
	const {fadeInStart, fullyVisible, fadeOutStart, end} = FINAL_CAPTION_TIMING;
	return smootherstep(fadeInStart, fullyVisible, t) * (1 - smootherstep(fadeOutStart, end, t));
};
