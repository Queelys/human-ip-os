/**
 * Mi identity kernel (身份内核).
 *
 * This module is the single source of truth for who Mi *is*. It is pure data
 * plus pure functions: no React, no Three.js scene objects, no shot logic.
 * Shot/presentation layers may read from it but must never mutate it, and any
 * geometry they derive from it must keep the declared topological invariants.
 *
 * Since C002 the authoritative identity is `DEFAULT_MI_SPEC` in
 * src/identity/miKernel.ts. `MI_IDENTITY` is the compact view the C001 test
 * composition consumes; its seed and knot are read from that spec so there is
 * a single source of truth.
 */
import {DEFAULT_MI_SPEC} from '../identity/miKernel';

export type TopologicalInvariants = {
	/** Genus of Mi's core surface (number of "handles"). */
	readonly genus: number;
	/** Euler characteristic χ = V − E + F = 2 − 2g for a closed orientable surface. */
	readonly eulerCharacteristic: number;
	readonly orientable: boolean;
	/** Torus-knot winding numbers (p, q) of the core strand; gcd(p, q) = 1. */
	readonly knot: {readonly p: number; readonly q: number};
};

export type MiIdentityKernel = {
	readonly version: string;
	readonly seed: number;
	readonly invariants: TopologicalInvariants;
};

export const MI_IDENTITY: MiIdentityKernel = Object.freeze({
	version: `c001-view/${DEFAULT_MI_SPEC.version}`,
	seed: DEFAULT_MI_SPEC.seed,
	invariants: Object.freeze({
		genus: 1,
		eulerCharacteristic: 0,
		orientable: true,
		knot: Object.freeze({p: DEFAULT_MI_SPEC.knot.p, q: DEFAULT_MI_SPEC.knot.q}),
	}),
});

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

/** Throws if the kernel's declared invariants are internally inconsistent. */
export const assertKernelConsistent = (kernel: MiIdentityKernel): void => {
	const {genus, eulerCharacteristic, knot} = kernel.invariants;
	if (eulerCharacteristic !== 2 - 2 * genus) {
		throw new Error(
			`Identity kernel invalid: χ=${eulerCharacteristic} but 2−2g=${2 - 2 * genus}`,
		);
	}
	if (gcd(knot.p, knot.q) !== 1) {
		throw new Error(`Identity kernel invalid: gcd(p=${knot.p}, q=${knot.q}) ≠ 1`);
	}
};
