import React from 'react';
import {Composition} from 'remotion';
import {C001RenderTest} from './compositions/C001RenderTest';
import {C001, FILM} from './config/film';

export const RemotionRoot: React.FC = () => {
	return (
		<Composition
			id={C001.id}
			component={C001RenderTest}
			durationInFrames={C001.durationInFrames}
			fps={FILM.fps}
			width={FILM.width}
			height={FILM.height}
		/>
	);
};
