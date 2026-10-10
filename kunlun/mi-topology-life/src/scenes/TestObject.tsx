/**
 * C001 rotating test object (presentation layer).
 *
 * All motion is a pure function of `frame`. `useFrame` / THREE.Clock are not
 * used, because during rendering <ThreeCanvas> advances R3F once per Remotion
 * frame and any delta-based animation would be non-deterministic.
 */
import React, {useMemo} from 'react';
import {Color} from 'three';
import {createCoreGeometry, createSatelliteField} from '../core/geometry';
import type {MiIdentityKernel} from '../core/identity';
import {loopPhase} from '../core/time';

const SATELLITE_COUNT = 1200;

export const TestObject: React.FC<{
	readonly kernel: MiIdentityKernel;
	readonly frame: number;
	readonly fps: number;
	readonly loopSeconds: number;
}> = ({kernel, frame, fps, loopSeconds}) => {
	const core = useMemo(() => createCoreGeometry(kernel), [kernel]);
	const satellites = useMemo(
		() => createSatelliteField(kernel, SATELLITE_COUNT),
		[kernel],
	);

	const phase = loopPhase(frame, fps, loopSeconds);
	const angle = phase * Math.PI * 2;
	const coreColor = useMemo(() => new Color('#7fd8ff'), []);
	const glowColor = useMemo(() => new Color('#1a3cff'), []);

	return (
		<group>
			<group rotation={[0.35, angle, 0.12 * Math.sin(angle)]}>
				<mesh geometry={core}>
					<meshStandardMaterial
						color={coreColor}
						emissive={glowColor}
						emissiveIntensity={0.35}
						metalness={0.4}
						roughness={0.3}
					/>
				</mesh>
				<mesh geometry={core} scale={1.002}>
					<meshBasicMaterial color="#bfefff" wireframe transparent opacity={0.12} />
				</mesh>
			</group>
			<points rotation={[0.18, -angle * 0.5, 0]}>
				<bufferGeometry>
					<bufferAttribute attach="attributes-position" args={[satellites, 3]} />
				</bufferGeometry>
				<pointsMaterial color="#9fb8ff" size={0.025} sizeAttenuation />
			</points>
		</group>
	);
};
