/**
 * 《弥：拓扑生命》 — 30 s silent visual master (C003).
 * Every pixel is a function of the global frame via filmStateAt(frame).
 */
import {ThreeCanvas} from '@remotion/three';
import React, {useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {FILM_DISC_PARTICLES, FILM_SPEC, filmStateAt} from '../film/choreography';
import {generateStarLayers} from '../film/starfield';
import {Anchors} from '../scenes/film/Anchors';
import {CameraRig} from '../scenes/film/CameraRig';
import {CoreKnot} from '../scenes/film/CoreKnot';
import {FilmBackground} from '../scenes/film/FilmBackground';
import {Network} from '../scenes/film/Network';
import {Starfield} from '../scenes/film/Starfield';
import {createGlowTexture} from '../scenes/film/textures';
import {Caption} from './Caption';

export type MiFilmProps = {
	/** Disable only for the caption pixel test; always true for deliverables. */
	readonly captionEnabled: boolean;
};

export const MiFilm: React.FC<MiFilmProps> = ({captionEnabled}) => {
	const frame = useCurrentFrame();
	const {width, height} = useVideoConfig();
	const state = useMemo(() => filmStateAt(frame), [frame]);
	const stars = useMemo(() => generateStarLayers(FILM_SPEC), []);
	const glowMap = useMemo(() => createGlowTexture(128, 0.2), []);
	const sparkMap = useMemo(() => createGlowTexture(128, 0.08), []);

	return (
		<AbsoluteFill style={{backgroundColor: '#000'}}>
			<ThreeCanvas
				width={width}
				height={height}
				flat
				camera={{fov: state.camera.fov, position: [...state.camera.position], near: 0.1, far: 200}}
				gl={{antialias: true, preserveDrawingBuffer: true}}
			>
				<CameraRig camera={state.camera} />
				<FilmBackground strength={state.env.background} aspect={width / height} />
				<Starfield layers={stars} time={state.time} strength={state.env.stars} />
				<Network
					nodes={state.peripheryNodes}
					edges={state.peripheryEdges}
					coreLinks={state.coreLinks}
					chords={state.chords}
					signals={state.signals}
					particles={FILM_DISC_PARTICLES}
					particleOpacity={Math.max(0, state.env.discParticles)}
					deformation={state.deformation}
					glowMap={glowMap}
				/>
				<CoreKnot spec={FILM_SPEC} deformation={state.deformation} arcs={state.arcs} glow={state.env.coreGlow} sparkMap={sparkMap} />
				<Anchors anchors={state.anchors} trailStrength={Math.max(0, state.env.trails)} glowMap={glowMap} />
			</ThreeCanvas>
			{captionEnabled ? <Caption opacity={state.env.caption} /> : null}
		</AbsoluteFill>
	);
};
