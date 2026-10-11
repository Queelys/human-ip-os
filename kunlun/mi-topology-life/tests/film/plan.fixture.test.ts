/** Exports the film plan for the Node render/verify scripts (single source of truth). */
import {mkdirSync, writeFileSync} from 'node:fs';
import {expect, it} from 'vitest';
import {FILM, FILM_DURATION_IN_FRAMES} from '../../src/config/film';
import {CAPTION_END, CAPTION_LAYOUT, CAPTION_START, CAPTION_TEXT, TITLE_SAFE} from '../../src/film/caption';
import {CAPTION_FADE_FRAMES} from '../../src/film/choreography';
import {ACTS, TRANSITIONS} from '../../src/film/timeline';

it('writes out/test-logs/film-plan.json', () => {
	const plan = {
		film: {...FILM, durationInFrames: FILM_DURATION_IN_FRAMES},
		acts: ACTS,
		transitions: TRANSITIONS,
		caption: {text: CAPTION_TEXT, start: CAPTION_START, fadeFrames: CAPTION_FADE_FRAMES, end: CAPTION_END, layout: CAPTION_LAYOUT},
		titleSafe: TITLE_SAFE,
	};
	expect(plan.acts).toHaveLength(5);
	mkdirSync('out/test-logs', {recursive: true});
	writeFileSync('out/test-logs/film-plan.json', JSON.stringify(plan, null, 2));
});
