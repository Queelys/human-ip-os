/**
 * 3D view of the identity kernel. Everything drawn is computed from
 * (spec, deformation, time) on each state change; no per-frame state.
 */
import {Canvas, useThree} from '@react-three/fiber';
import React, {useEffect, useMemo} from 'react';
import {BufferGeometry, CanvasTexture, Curve, Float32BufferAttribute, SRGBColorSpace, Vector3} from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import type {AnchorState} from '../identity/anchors';
import type {MiIdentitySpec} from '../identity/miKernel';
import {knotPoint} from '../geometry/trefoil';
import type {Vec3} from '../geometry/vec3';
import {applyDeformation, type Deformation} from '../motion/deformation';
import type {AnchorId} from '../identity/miKernel';

class DeformedKnot extends Curve<Vector3> {
	constructor(
		private readonly spec: MiIdentitySpec,
		private readonly d: Deformation,
	) {
		super();
	}

	override getPoint(s: number, target = new Vector3()): Vector3 {
		const [x, y, z] = applyDeformation(this.d, knotPoint(this.spec.knot, s));
		return target.set(x, y, z);
	}
}

const ANCHOR_COLORS: Record<AnchorId, string> = {A1: '#ffd36b', A2: '#6bffb8', A3: '#ff7bd5'};

const labelTexture = (text: string, color: string): CanvasTexture => {
	const c = document.createElement('canvas');
	c.width = 512;
	c.height = 128;
	const g = c.getContext('2d');
	if (g) {
		g.font = '600 56px "WenQuanYi Zen Hei", ui-monospace, monospace';
		g.fillStyle = 'rgba(3,4,10,0.65)';
		g.fillRect(0, 16, 512, 96);
		g.fillStyle = color;
		g.textBaseline = 'middle';
		g.fillText(text, 20, 64);
	}
	const t = new CanvasTexture(c);
	t.colorSpace = SRGBColorSpace;
	return t;
};

const Controls: React.FC = () => {
	const {camera, gl} = useThree();
	useEffect(() => {
		const c = new OrbitControls(camera, gl.domElement);
		c.enableDamping = false;
		return () => c.dispose();
	}, [camera, gl]);
	return null;
};

const lineGeometry = (segments: readonly (readonly [Vec3, Vec3])[]): BufferGeometry => {
	const g = new BufferGeometry();
	g.setAttribute('position', new Float32BufferAttribute(segments.flatMap(([a, b]) => [...a, ...b]), 3));
	return g;
};

export type SceneProps = {
	readonly spec: MiIdentitySpec;
	readonly deformation: Deformation;
	readonly anchors: readonly AnchorState[];
	readonly pulses: Record<AnchorId, number>;
	readonly peripheryNodes: readonly Vec3[];
	readonly peripheryEdges: readonly (readonly [number, number])[];
	readonly particles: Float32Array;
};

const SceneContent: React.FC<SceneProps> = ({spec, deformation, anchors, pulses, peripheryNodes, peripheryEdges, particles}) => {
	const curve = useMemo(() => new DeformedKnot(spec, deformation), [spec, deformation]);
	const labels = useMemo(
		() => Object.fromEntries(spec.anchors.map((a) => [a.id, labelTexture(`${a.id} ${a.label}`, ANCHOR_COLORS[a.id])])),
		[spec],
	) as Record<AnchorId, CanvasTexture>;

	const byId = Object.fromEntries(anchors.map((a) => [a.id, a])) as Record<AnchorId, AnchorState>;
	const coreEdges = useMemo(
		() => lineGeometry(spec.graph.edges.map((e) => [byId[e.from].world, byId[e.to].world] as const)),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[spec, anchors],
	);
	const deformedNodes = useMemo(() => peripheryNodes.map((v) => applyDeformation(deformation, v)), [peripheryNodes, deformation]);
	const periphery = useMemo(
		() => lineGeometry(peripheryEdges.map(([i, j]) => [deformedNodes[i], deformedNodes[j]] as const)),
		[peripheryEdges, deformedNodes],
	);
	const nodePoints = useMemo(() => {
		const g = new BufferGeometry();
		g.setAttribute('position', new Float32BufferAttribute(deformedNodes.flat(), 3));
		return g;
	}, [deformedNodes]);
	const particleGeo = useMemo(() => {
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

	return (
		<>
			<color attach="background" args={['#03040a']} />
			<ambientLight intensity={0.4} />
			<directionalLight position={[4, 6, 5]} intensity={2} />
			<mesh>
				<tubeGeometry args={[curve, 400, 0.06, 10, true]} />
				<meshStandardMaterial color="#7fd8ff" emissive="#1a3cff" emissiveIntensity={0.4} roughness={0.35} />
			</mesh>
			<lineSegments geometry={coreEdges}>
				<lineBasicMaterial color="#ffffff" transparent opacity={0.85} />
			</lineSegments>
			<lineSegments geometry={periphery}>
				<lineBasicMaterial color="#5b6fb0" transparent opacity={0.35} />
			</lineSegments>
			<points geometry={nodePoints}>
				<pointsMaterial color="#9fb8ff" size={0.06} sizeAttenuation />
			</points>
			<points geometry={particleGeo}>
				<pointsMaterial color="#8090c0" size={0.02} sizeAttenuation transparent opacity={0.6} />
			</points>
			{anchors.map((a) => (
				<group key={a.id} position={a.world as unknown as [number, number, number]}>
					<mesh scale={0.12 * (1 + 0.8 * pulses[a.id])}>
						<sphereGeometry args={[1, 24, 16]} />
						<meshStandardMaterial color={ANCHOR_COLORS[a.id]} emissive={ANCHOR_COLORS[a.id]} emissiveIntensity={0.3 + 1.5 * pulses[a.id]} />
					</mesh>
					<sprite position={[0.55, 0.32, 0]} scale={[1, 0.25, 1]}>
						<spriteMaterial map={labels[a.id]} depthTest={false} transparent />
					</sprite>
				</group>
			))}
			<axesHelper args={[0.6]} />
			<Controls />
		</>
	);
};

export const IdentityScene: React.FC<SceneProps> = (props) => (
	<Canvas camera={{fov: 40, position: [0, -7.5, 5], up: [0, 0, 1]}} gl={{antialias: true, preserveDrawingBuffer: true}}>
		<SceneContent {...props} />
	</Canvas>
);
