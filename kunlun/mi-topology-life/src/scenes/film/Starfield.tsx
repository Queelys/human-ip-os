import React, {useMemo} from 'react';
import {AdditiveBlending, BufferAttribute, BufferGeometry, Color} from 'three';
import type {StarLayer} from '../../film/starfield';

const vertex = /* glsl */ `
attribute float aSize;
attribute float aPhase;
attribute float aRate;
uniform float uTime;
uniform float uTwinkle;
varying float vBright;
void main() {
	vec4 mv = modelViewMatrix * vec4(position, 1.0);
	// Closed-form, bounded twinkle in [1 - uTwinkle, 1].
	float tw = 0.5 + 0.5 * sin(6.2831853 * (uTime * aRate + aPhase));
	vBright = 1.0 - uTwinkle + uTwinkle * tw;
	gl_PointSize = clamp(aSize * (30.0 / -mv.z), 1.0, 6.0);
	gl_Position = projectionMatrix * mv;
}`;

const fragment = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vBright;
void main() {
	vec2 c = gl_PointCoord - 0.5;
	float a = smoothstep(0.5, 0.0, length(c));
	gl_FragColor = vec4(uColor * a * vBright * uOpacity, 1.0);
}`;

export const Starfield: React.FC<{readonly layers: readonly StarLayer[]; readonly time: number; readonly strength: number}> = ({
	layers,
	time,
	strength,
}) => {
	const geos = useMemo(
		() =>
			layers.map((l) => {
				const g = new BufferGeometry();
				g.setAttribute('position', new BufferAttribute(l.positions, 3));
				g.setAttribute('aSize', new BufferAttribute(l.sizes, 1));
				g.setAttribute('aPhase', new BufferAttribute(l.phases, 1));
				g.setAttribute('aRate', new BufferAttribute(l.rates, 1));
				return g;
			}),
		[layers],
	);
	return (
		<>
			{layers.map((l, i) => (
				<points key={l.name} geometry={geos[i]} frustumCulled={false}>
					<shaderMaterial
						vertexShader={vertex}
						fragmentShader={fragment}
						transparent
						depthWrite={false}
						blending={AdditiveBlending}
						uniforms={{
							uTime: {value: 0},
							uTwinkle: {value: l.twinkle},
							uColor: {value: new Color(l.color)},
							uOpacity: {value: 0},
						}}
						uniforms-uTime-value={time}
						uniforms-uOpacity-value={l.opacity * strength}
					/>
				</points>
			))}
		</>
	);
};
