/**
 * C004.7 final mux: picture (MI-Final render, H.264) + final AAC, both
 * stream-copied (no re-encode), into renders/masters/mi-final-1080p.mp4.
 */
import {mkdirSync} from 'node:fs';
import {run} from './lib.mjs';

const VIDEO = 'out/final/mi-final-picture-1080p.mp4';
const AUDIO = 'renders/audio/mi-audio-final.m4a';
const OUT = 'renders/masters/mi-final-1080p.mp4';
mkdirSync('renders/masters', {recursive: true});
run('ffmpeg', [
	'-v', 'error', '-y',
	'-i', VIDEO,
	'-i', AUDIO,
	'-map', '0:v:0',
	'-map', '1:a:0',
	'-c', 'copy',
	'-metadata', 'title=弥：拓扑生命 Mi: Topological Life',
	'-movflags', '+faststart',
	OUT,
]);
console.log(`muxed ${VIDEO} + ${AUDIO} → ${OUT}`);
