/**
 * Seeded pseudo-random number generation.
 *
 * Math.random() is forbidden in this project: every random value must be
 * reproducible from a fixed seed so that any frame can be re-rendered
 * bit-for-bit, in any order, on any worker.
 */

/** Mulberry32: small, fast, well-distributed 32-bit PRNG. Returns [0, 1). */
export const mulberry32 = (seed: number): (() => number) => {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

/** FNV-1a hash, used to derive independent sub-seeds from string labels. */
export const hashString = (input: string): number => {
	let h = 0x811c9dc5;
	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
};

/** Derive a stable child seed so subsystems never share a random stream. */
export const deriveSeed = (seed: number, label: string): number =>
	(hashString(label) ^ Math.imul(seed >>> 0, 0x9e3779b1)) >>> 0;

export const createRng = (seed: number, label: string) =>
	mulberry32(deriveSeed(seed, label));
