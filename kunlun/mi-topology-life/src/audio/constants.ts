import {FILM} from '../config/film';

export const SAMPLE_RATE = 48000;
export const CHANNELS = 2;
export const DURATION_SECONDS = FILM.durationInSeconds;
export const TOTAL_SAMPLES = SAMPLE_RATE * DURATION_SECONDS; // 1 440 000
/** Control-rate step for envelopes (1 ms); values are linearly interpolated per sample. */
export const CONTROL_STEP = 48;
