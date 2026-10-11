/** Periphery network, core links, core-graph chords, signals and disc particles. */
import React from 'react';
import {AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute, type Texture} from 'three';
import type {LineRender, PointRender} from '../../film/choreography';
import {applyDeformation, type Deformation} from '../../motion/deformation';
import {useDisposable} from './useDisposable';

const lineGeometry = (lines: readonly LineRender[], color: string): BufferGeometry => {
	const c = new Color(color);
	const g = new BufferGeometry();
	g.setAttribute('position', new Float32BufferAttribute(lines.flatMap((l) => [...l.a, ...l.b]), 3));
	g.setAttribute('color', new Float32BufferAttribute(lines.flatMap((l) => [c.r * l.alpha, c.g * l.alpha, c.b * l.alpha, c.r * l.alpha, c.g * l.alpha, c.b * l.alpha]), 3));
	return g;
};

const pointGeometry = (points: readonly PointRender[]): BufferGeometry => {
	const g = new BufferGeometry();
	g.setAttribute('position', new Float32BufferAttribute(points.flatMap((p) => [...p.p]), 3));
	g.setAttribute('color', new Float32BufferAttribute(points.flatMap((p) => [p.intensity, p.intensity, p.intensity]), 3));
	return g;
};

const Lines: React.FC<{readonly lines: readonly LineRender[]; readonly color: string}> = ({lines, color}) => {
	const geo = useDisposable(() => lineGeometry(lines, color), [lines, color]);
	return (
		<lineSegments geometry={geo} frustumCulled={false}>
			<lineBasicMaterial vertexColors transparent blending={AdditiveBlending} depthWrite={false} />
		</lineSegments>
	);
};

const Points: React.FC<{readonly points: readonly PointRender[]; readonly color: string; readonly size: number; readonly map: Texture}> = ({
	points,
	color,
	size,
	map,
}) => {
	const geo = useDisposable(() => pointGeometry(points), [points]);
	return (
		<points geometry={geo} frustumCulled={false}>
			<pointsMaterial map={map} color={color} vertexColors size={size} sizeAttenuation transparent blending={AdditiveBlending} depthWrite={false} />
		</points>
	);
};

const DiscParticles: React.FC<{
	readonly particles: Float32Array;
	readonly deformation: Deformation;
	readonly opacity: number;
	readonly map: Texture;
}> = ({particles, deformation, opacity, map}) => {
	const geo = useDisposable(() => {
		const out = new Float32Array(particles.length);
		for (let i = 0; i < particles.length; i += 3) {
			const v = applyDeformation(deformation, [particles[i], particles[i + 1], particles[i + 2]]);
			out[i] = v[0];
			out[i + 1] = v[1];
			out[i + 2] = v[2];
		}
		const g = new BufferGeometry();
		g.setAttribute('position', new Float32BufferAttribute(out, 3));
		return g;
	}, [particles, deformation]);
	if (opacity <= 0) return null;
	return (
		<points geometry={geo} frustumCulled={false}>
			<pointsMaterial map={map} color="#6f86d6" size={0.045} sizeAttenuation transparent opacity={opacity} blending={AdditiveBlending} depthWrite={false} />
		</points>
	);
};

export const Network: React.FC<{
	readonly nodes: readonly PointRender[];
	readonly edges: readonly LineRender[];
	readonly coreLinks: readonly LineRender[];
	readonly chords: readonly LineRender[];
	readonly signals: readonly PointRender[];
	readonly particles: Float32Array;
	readonly particleOpacity: number;
	readonly deformation: Deformation;
	readonly glowMap: Texture;
}> = ({nodes, edges, coreLinks, chords, signals, particles, particleOpacity, deformation, glowMap}) => (
	<>
		<DiscParticles particles={particles} deformation={deformation} opacity={particleOpacity} map={glowMap} />
		<Lines lines={edges} color="#5f7ae0" />
		<Lines lines={coreLinks} color="#3d6cff" />
		<Lines lines={chords} color="#e8f4ff" />
		<Points points={nodes} color="#a9c1ff" size={0.09} map={glowMap} />
		<Points points={signals} color="#c8fbff" size={0.13} map={glowMap} />
	</>
);
