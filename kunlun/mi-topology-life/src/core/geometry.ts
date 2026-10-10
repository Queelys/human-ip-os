/**
 * Pure geometry builders derived from the identity kernel. They depend only on
 * the kernel (and fixed seeds), never on time, so the same kernel always yields
 * the same geometry.
 */
import {TorusKnotGeometry} from 'three';
import type {MiIdentityKernel} from './identity';
import {createRng} from './rng';

export const CORE_GEOMETRY_PARAMS = {
	radius: 1.2,
	tube: 0.32,
	tubularSegments: 256,
	radialSegments: 32,
} as const;

/** Mi's core strand: a (p, q) torus knot whose tube surface has genus 1. */
export const createCoreGeometry = (kernel: MiIdentityKernel): TorusKnotGeometry => {
	const {radius, tube, tubularSegments, radialSegments} = CORE_GEOMETRY_PARAMS;
	const {p, q} = kernel.invariants.knot;
	return new TorusKnotGeometry(radius, tube, tubularSegments, radialSegments, p, q);
};

/**
 * Seeded "galaxy" particle shell around the core. Returns flat xyz positions.
 */
export const createSatelliteField = (
	kernel: MiIdentityKernel,
	count: number,
): Float32Array => {
	const rng = createRng(kernel.seed, 'satellite-field');
	const out = new Float32Array(count * 3);
	for (let i = 0; i < count; i++) {
		// Logarithmic-spiral arms in a thick disc.
		const arm = i % 3;
		const r = 2.2 + rng() * 2.6;
		const theta = (arm / 3) * Math.PI * 2 + Math.log(r) * 2.4 + (rng() - 0.5) * 0.6;
		const y = (rng() - 0.5) * 0.5 * (1 / r) * 2;
		out[i * 3] = Math.cos(theta) * r;
		out[i * 3 + 1] = y;
		out[i * 3 + 2] = Math.sin(theta) * r;
	}
	return out;
};
