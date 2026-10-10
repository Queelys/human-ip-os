/**
 * Minimal immutable 3-vector math for the identity kernel. Kept free of
 * Three.js so kernel code is pure, allocation-light and trivially testable.
 */
export type Vec3 = readonly [number, number, number];

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
	a[1] * b[2] - a[2] * b[1],
	a[2] * b[0] - a[0] * b[2],
	a[0] * b[1] - a[1] * b[0],
];
export const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
export const distance = (a: Vec3, b: Vec3): number => length(sub(a, b));
export const normalize = (a: Vec3): Vec3 => {
	const l = length(a);
	if (l === 0) {
		throw new Error('Cannot normalize zero vector');
	}
	return scale(a, 1 / l);
};
export const isFiniteVec = (a: Vec3): boolean => a.every(Number.isFinite);

/** Determinant of the 3×3 matrix with columns c0, c1, c2. */
export const det3 = (c0: Vec3, c1: Vec3, c2: Vec3): number => dot(c0, cross(c1, c2));
