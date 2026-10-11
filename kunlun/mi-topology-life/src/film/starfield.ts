/**
 * Three seeded star layers for depth (far / mid / near). Twinkle is a bounded
 * closed-form function of time evaluated in the shader — no uncontrolled
 * random flicker: brightness ∈ [base·(1 − amp), base].
 */
import {createRng} from '../core/rng';
import type {MiIdentitySpec} from '../identity/miKernel';

export type StarLayer = {
	readonly name: 'far' | 'mid' | 'near';
	readonly positions: Float32Array;
	/** Point size in pixels at reference depth. */
	readonly sizes: Float32Array;
	readonly phases: Float32Array;
	/** Twinkle frequency in Hz. */
	readonly rates: Float32Array;
	readonly color: string;
	readonly opacity: number;
	/** Twinkle amplitude in [0, 1). */
	readonly twinkle: number;
};

const layer = (
	spec: MiIdentitySpec,
	name: StarLayer['name'],
	count: number,
	rMin: number,
	rMax: number,
	size: [number, number],
	color: string,
	opacity: number,
	twinkle: number,
): StarLayer => {
	const rng = createRng(spec.seed, `c003:stars:${name}`);
	const positions = new Float32Array(count * 3);
	const sizes = new Float32Array(count);
	const phases = new Float32Array(count);
	const rates = new Float32Array(count);
	for (let i = 0; i < count; i++) {
		// Uniform direction on the sphere.
		const u = rng() * 2 - 1;
		const th = rng() * Math.PI * 2;
		const r = rMin + (rMax - rMin) * Math.cbrt(rng());
		const sq = Math.sqrt(1 - u * u);
		positions[i * 3] = r * sq * Math.cos(th);
		positions[i * 3 + 1] = r * sq * Math.sin(th);
		positions[i * 3 + 2] = r * u;
		sizes[i] = size[0] + (size[1] - size[0]) * rng() ** 2;
		phases[i] = rng();
		rates[i] = 0.08 + 0.35 * rng();
	}
	return {name, positions, sizes, phases, rates, color, opacity, twinkle};
};

export const generateStarLayers = (spec: MiIdentitySpec): readonly StarLayer[] => [
	layer(spec, 'far', 2600, 45, 75, [1.0, 2.2], '#9fb4ff', 0.75, 0.25),
	layer(spec, 'mid', 900, 16, 32, [1.4, 3.0], '#c7d6ff', 0.55, 0.15),
	layer(spec, 'near', 120, 11, 15, [2.5, 5.0], '#7f9cff', 0.22, 0.1),
];
