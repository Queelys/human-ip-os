import {ThreeCanvas} from '@remotion/three';
import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {C001} from '../config/film';
import {MI_IDENTITY} from '../core/identity';
import {TestObject} from '../scenes/TestObject';

export const C001RenderTest: React.FC = () => {
	const frame = useCurrentFrame();
	const {width, height, fps, durationInFrames} = useVideoConfig();

	return (
		<AbsoluteFill style={{backgroundColor: '#03040a'}}>
			<ThreeCanvas
				width={width}
				height={height}
				camera={{fov: 40, position: [0, 0.6, 8]}}
				gl={{antialias: true, preserveDrawingBuffer: true}}
			>
				<color attach="background" args={['#03040a']} />
				<ambientLight intensity={0.35} />
				<directionalLight position={[4, 6, 5]} intensity={2.2} />
				<pointLight position={[-4, -2, 3]} intensity={30} color="#4060ff" />
				<TestObject
					kernel={MI_IDENTITY}
					frame={frame}
					fps={fps}
					loopSeconds={C001.durationInSeconds}
				/>
			</ThreeCanvas>
			<div
				style={{
					position: 'absolute',
					left: 64,
					bottom: 48,
					fontFamily: 'monospace',
					fontSize: 28,
					letterSpacing: 2,
					color: '#8fa8d8',
				}}
			>
				KUNLUN-MI · C001 · F{String(frame).padStart(3, '0')}/
				{String(durationInFrames).padStart(3, '0')}
			</div>
		</AbsoluteFill>
	);
};
