/**
 * A — anchor system. An anchor's identity is its curve parameter s, never a
 * vertex index: positions are always computed as Φ(K(s)).
 */
import {knotDerivative, knotPoint} from '../geometry/trefoil';
import type {Vec3} from '../geometry/vec3';
import {applyDeformation, type Deformation, IDENTITY_DEFORMATION} from '../motion/deformation';
import type {AnchorId, MiAnchor, MiIdentitySpec} from './miKernel';

export type AnchorState = {
	readonly id: AnchorId;
	readonly label: string;
	readonly s: number;
	/** Undeformed position K(s). */
	readonly local: Vec3;
	/** Deformed position Φ(K(s)). */
	readonly world: Vec3;
	/** Undeformed unit-speed-agnostic tangent K′(s). */
	readonly tangent: Vec3;
};

export const getAnchor = (spec: MiIdentitySpec, id: AnchorId): MiAnchor => {
	const a = spec.anchors.find((x) => x.id === id);
	if (!a) {
		throw new Error(`Unknown anchor ${id}`);
	}
	return a;
};

export const anchorStates = (
	spec: MiIdentitySpec,
	deformation: Deformation = IDENTITY_DEFORMATION,
): readonly AnchorState[] =>
	spec.anchors.map((a) => {
		const local = knotPoint(spec.knot, a.s);
		return {
			id: a.id,
			label: a.label,
			s: a.s,
			local,
			world: applyDeformation(deformation, local),
			tangent: knotDerivative(spec.knot, a.s),
		};
	});
