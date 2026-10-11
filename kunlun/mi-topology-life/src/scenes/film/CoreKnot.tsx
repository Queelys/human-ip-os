/**
 * Core knot K under Φ(t), drawn as three anchor-to-anchor arc tubes (the
 * ACT II reveal mask) with two additive glow shells. Geometry is rebuilt
 * from (spec, Φ, reveal) every frame and disposed afterwards.
 */
import React from 'react';
import {AdditiveBlending, Curve, type Texture, TubeGeometry, Vector3} from 'three';
import type {ArcRender} from '../../film/choreography';
import {knotPoint} from '../../geometry/trefoil';
import type {MiIdentitySpec} from '../../identity/miKernel';
import {applyDeformation, type Deformation} from '../../motion/deformation';
import {CORE_TUBE_RADIUS, GLOW_SHELL_RADII as GLOW_RADII} from '../../film/visual';
import {useDisposable} from './useDisposable';

const GLOW_OPACITY = [0.22, 0.07] as const;

class ArcCurve extends Curve<Vector3> {
	constructor(
		private readonly spec: MiIdentitySpec,
		private readonly d: Deformation,
		private readonly s0: number,
		private readonly length: number,
	) {
		super();
	}

	override getPoint(u: number, target = new Vector3()): Vector3 {
		const [x, y, z] = applyDeformation(this.d, knotPoint(this.spec.knot, this.s0 + u * this.length));
		return target.set(x, y, z);
	}
}

const MIN_REVEAL = 1e-3;

const Arc: React.FC<{
	readonly spec: MiIdentitySpec;
	readonly deformation: Deformation;
	readonly arc: ArcRender;
	readonly glow: number;
	readonly sparkMap: Texture;
}> = ({spec, deformation, arc, glow, sparkMap}) => {
	const segments = Math.max(2, Math.ceil(arc.reveal * 220));
	const curve = new ArcCurve(spec, deformation, arc.s0, Math.max(arc.length, MIN_REVEAL / 3));
	const core = useDisposable(() => new TubeGeometry(curve, segments, CORE_TUBE_RADIUS, 10, false), [deformation, arc.length]);
	const g0 = useDisposable(() => new TubeGeometry(curve, segments, GLOW_RADII[0], 10, false), [deformation, arc.length]);
	const g1 = useDisposable(() => new TubeGeometry(curve, segments, GLOW_RADII[1], 10, false), [deformation, arc.length]);
	if (arc.reveal < MIN_REVEAL) {
		return null;
	}
	// The growth tip sparkles only while the arc is still growing.
	const growing = arc.reveal < 1 ? Math.min(1, arc.reveal * 12) * (1 - arc.reveal ** 8) : 0;
	return (
		<group>
			<mesh geometry={core}>
				<meshBasicMaterial color="#9ff4ff" transparent opacity={Math.min(1, 0.55 + glow * 0.6)} />
			</mesh>
			<mesh geometry={g0}>
				<meshBasicMaterial color="#2f8dff" transparent opacity={GLOW_OPACITY[0] * glow} blending={AdditiveBlending} depthWrite={false} />
			</mesh>
			<mesh geometry={g1}>
				<meshBasicMaterial color="#1c4dff" transparent opacity={GLOW_OPACITY[1] * glow} blending={AdditiveBlending} depthWrite={false} />
			</mesh>
			{growing > 0 ? (
				<sprite position={arc.tip as unknown as [number, number, number]} scale={[0.55, 0.55, 1]}>
					<spriteMaterial map={sparkMap} color="#d8fbff" opacity={0.9 * growing} blending={AdditiveBlending} depthWrite={false} transparent />
				</sprite>
			) : null}
		</group>
	);
};

export const CoreKnot: React.FC<{
	readonly spec: MiIdentitySpec;
	readonly deformation: Deformation;
	readonly arcs: readonly ArcRender[];
	readonly glow: number;
	readonly sparkMap: Texture;
}> = ({spec, deformation, arcs, glow, sparkMap}) => (
	<>
		{arcs.map((a) => (
			<Arc key={a.from} spec={spec} deformation={deformation} arc={a} glow={glow} sparkMap={sparkMap} />
		))}
	</>
);
