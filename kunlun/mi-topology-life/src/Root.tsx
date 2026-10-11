import React from 'react';
import {Composition} from 'remotion';
import {C001RenderTest} from './compositions/C001RenderTest';
import {MiFilm} from './compositions/MiFilm';
import {MiFinal} from './compositions/MiFinal';
import {C001, FILM, FILM_DURATION_IN_FRAMES} from './config/film';

export const RemotionRoot: React.FC = () => {
	return (
		<>
			<Composition
				id={C001.id}
				component={C001RenderTest}
				durationInFrames={C001.durationInFrames}
				fps={FILM.fps}
				width={FILM.width}
				height={FILM.height}
			/>
			<Composition
				id="MI-Film"
				component={MiFilm}
				durationInFrames={FILM_DURATION_IN_FRAMES}
				fps={FILM.fps}
				width={FILM.width}
				height={FILM.height}
				defaultProps={{captionEnabled: true}}
			/>
			<Composition
				id="MI-Final"
				component={MiFinal}
				durationInFrames={FILM_DURATION_IN_FRAMES}
				fps={FILM.fps}
				width={FILM.width}
				height={FILM.height}
			/>
		</>
	);
};
