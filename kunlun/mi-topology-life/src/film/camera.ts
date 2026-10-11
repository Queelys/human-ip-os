/**
 * C003.2 camera rig. The camera is a pure function of the global frame:
 * keyframes in orbit coordinates (azimuth, elevation, distance around a
 * target) interpolated with smootherstep, so position, target and field of
 * view are C² continuous everywhere — including at act boundaries, where the
 * rig is always at a keyframe with zero velocity.
 *
 * Frame of reference: the knot lies in the xy-plane; "frontal" means looking
 * down −z from +z with +y up (the canonical three-fold trefoil view).
 */
import type {Vec3} from '../geometry/vec3';
import {clamp, lerp, smootherstep} from './easing';

export type CameraKey = {
	readonly frame: number;
	/** Rotation around +y, radians (0 = on the +z axis). */
	readonly azimuth: number;
	/** Elevation above the xz-plane, radians. */
	readonly elevation: number;
	readonly distance: number;
	readonly target: Vec3;
	/** Vertical field of view, degrees. */
	readonly fov: number;
};

export type CameraState = {
	readonly position: Vec3;
	readonly target: Vec3;
	readonly up: Vec3;
	readonly fov: number;
	readonly azimuth: number;
	readonly elevation: number;
	readonly distance: number;
};

export const CAMERA_KEYS: readonly CameraKey[] = Object.freeze([
	// ACT I — fixed camera, slightly right of centre on A1.
	{frame: 0, azimuth: 0, elevation: 0, distance: 10, target: [1.2, 0, 0], fov: 32},
	{frame: 149, azimuth: 0, elevation: 0, distance: 10, target: [1.2, 0, 0], fov: 32},
	// ACT II — slow push-in toward the core.
	{frame: 329, azimuth: 0.14, elevation: 0.12, distance: 6.4, target: [0.35, 0, 0], fov: 32},
	// ACT III — small-angle orbit (≈ 21° azimuth).
	{frame: 539, azimuth: 0.5, elevation: 0.26, distance: 6.2, target: [0, 0, 0], fov: 32},
	// ACT IV — pull back.
	{frame: 749, azimuth: 0.3, elevation: 0.16, distance: 9.6, target: [0, 0, 0], fov: 34},
	// ACT V — return to frontal (camera on the +z axis), then hold. The target
	// sits below the origin so the knot frames above the caption.
	{frame: 840, azimuth: 0, elevation: 0, distance: 10, target: [0, -0.55, 0], fov: 32},
	{frame: 899, azimuth: 0, elevation: 0, distance: 10, target: [0, -0.55, 0], fov: 32},
] as const satisfies readonly CameraKey[]);

const lerpVec = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export const orbitPosition = (target: Vec3, azimuth: number, elevation: number, distance: number): Vec3 => [
	target[0] + distance * Math.sin(azimuth) * Math.cos(elevation),
	target[1] + distance * Math.sin(elevation),
	target[2] + distance * Math.cos(azimuth) * Math.cos(elevation),
];

export const cameraAt = (frame: number, keys: readonly CameraKey[] = CAMERA_KEYS): CameraState => {
	const f = clamp(frame, keys[0].frame, keys[keys.length - 1].frame);
	let i = 0;
	while (i < keys.length - 2 && f > keys[i + 1].frame) i++;
	const a = keys[i];
	const b = keys[i + 1];
	const t = smootherstep(a.frame, b.frame, f);
	const azimuth = lerp(a.azimuth, b.azimuth, t);
	const elevation = lerp(a.elevation, b.elevation, t);
	const distance = lerp(a.distance, b.distance, t);
	const target = lerpVec(a.target, b.target, t);
	return {
		position: orbitPosition(target, azimuth, elevation, distance),
		target,
		up: [0, 1, 0],
		fov: lerp(a.fov, b.fov, t),
		azimuth,
		elevation,
		distance,
	};
};
