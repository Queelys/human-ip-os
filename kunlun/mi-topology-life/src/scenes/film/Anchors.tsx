import React from 'react';
import {AdditiveBlending, BufferGeometry, Float32BufferAttribute, type Texture} from 'three';
import type {AnchorRender} from '../../film/choreography';
import type {AnchorId} from '../../identity/miKernel';
import {useDisposable} from './useDisposable';

export const ANCHOR_COLORS: Record<AnchorId, string> = {A1: '#ffd38a', A2: '#8affd0', A3: '#ff9ad8'};

const Trail: React.FC<{readonly anchor: AnchorRender; readonly strength: number; readonly map: Texture}> = ({anchor, strength, map}) => {
	const geo = useDisposable(() => {
		const g = new BufferGeometry();
		const n = anchor.trail.length;
		g.setAttribute('position', new Float32BufferAttribute(anchor.trail.flat(), 3));
		// Fading tail encoded in vertex colour (additive blending on black).
		g.setAttribute('color', new Float32BufferAttribute(anchor.trail.flatMap((_, k) => {
			const a = (1 - (k + 1) / (n + 1)) * strength * anchor.visibility;
			return [a, a, a];
		}), 3));
		return g;
	}, [anchor.trail, strength, anchor.visibility]);
	if (anchor.trail.length === 0 || strength <= 0) return null;
	return (
		<points geometry={geo}>
			<pointsMaterial map={map} color={ANCHOR_COLORS[anchor.id]} vertexColors size={0.16} sizeAttenuation transparent blending={AdditiveBlending} depthWrite={false} />
		</points>
	);
};

export const Anchors: React.FC<{
	readonly anchors: readonly AnchorRender[];
	readonly trailStrength: number;
	readonly glowMap: Texture;
}> = ({anchors, trailStrength, glowMap}) => (
	<>
		{anchors.map((a) =>
			a.visibility > 1e-3 ? (
				<group key={a.id}>
					<group position={a.world as unknown as [number, number, number]}>
						<mesh scale={0.07 + 0.03 * Math.min(1.5, a.brightness)}>
							<sphereGeometry args={[1, 24, 16]} />
							<meshBasicMaterial color={ANCHOR_COLORS[a.id]} transparent opacity={Math.min(1, a.visibility)} />
						</mesh>
						<sprite scale={[0.9 + 0.7 * a.brightness, 0.9 + 0.7 * a.brightness, 1]}>
							<spriteMaterial
								map={glowMap}
								color={ANCHOR_COLORS[a.id]}
								opacity={Math.min(1, 0.85 * a.brightness)}
								blending={AdditiveBlending}
								depthWrite={false}
								transparent
							/>
						</sprite>
					</group>
					<Trail anchor={a} strength={trailStrength} map={glowMap} />
				</group>
			) : null,
		)}
	</>
);
