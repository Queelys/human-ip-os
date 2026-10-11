/** Deep-space background: full-screen radial gradient, drawn first. */
import React from 'react';
import {Color} from 'three';

const vertex = /* glsl */ `
varying vec2 vUv;
void main() {
	vUv = uv;
	gl_Position = vec4(position.xy, 0.9999, 1.0);
}`;

const fragment = /* glsl */ `
uniform vec3 uCenter;
uniform vec3 uEdge;
uniform float uStrength;
uniform float uAspect;
varying vec2 vUv;
void main() {
	vec2 p = (vUv - vec2(0.5, 0.48)) * vec2(uAspect, 1.0);
	float d = length(p);
	float g = smoothstep(0.95, 0.0, d);
	vec3 col = mix(uEdge, uCenter, g * g) * uStrength;
	gl_FragColor = vec4(col, 1.0);
}`;

export const FilmBackground: React.FC<{readonly strength: number; readonly aspect: number}> = ({strength, aspect}) => (
	<mesh frustumCulled={false} renderOrder={-10}>
		<planeGeometry args={[2, 2]} />
		<shaderMaterial
			vertexShader={vertex}
			fragmentShader={fragment}
			depthTest={false}
			depthWrite={false}
			uniforms={{
				uCenter: {value: new Color('#0c1a3a')},
				uEdge: {value: new Color('#010206')},
				uStrength: {value: 0},
				uAspect: {value: 1},
			}}
			uniforms-uStrength-value={strength}
			uniforms-uAspect-value={aspect}
		/>
	</mesh>
);
