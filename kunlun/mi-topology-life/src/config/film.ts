/**
 * Global film specification. Every composition reads from here so that
 * resolution, frame rate and duration can never drift between shots.
 */
export const FILM = {
	title: '弥：拓扑生命',
	titleEn: 'Mi: Topological Life',
	width: 1920,
	height: 1080,
	fps: 30,
	durationInSeconds: 30,
} as const;

export const FILM_DURATION_IN_FRAMES = FILM.fps * FILM.durationInSeconds;

/** C001 render-chain test: 3 s @ 30 fps = 90 frames. */
export const C001 = {
	id: 'C001-RenderTest',
	durationInSeconds: 3,
	durationInFrames: FILM.fps * 3,
} as const;
