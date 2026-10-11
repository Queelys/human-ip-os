import {mkdirSync, writeFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {FILM_DURATION_IN_FRAMES} from '../../src/config/film';
import {CAMERA_KEYS, cameraAt} from '../../src/film/camera';
import {ACTS} from '../../src/film/timeline';
import {distance, dot, normalize, sub, type Vec3} from '../../src/geometry/vec3';

const frames = Array.from({length: FILM_DURATION_IN_FRAMES}, (_, f) => cameraAt(f));
const viewDir = (f: number): Vec3 => normalize(sub(frames[f].target, frames[f].position));
const angle = (a: Vec3, b: Vec3) => Math.acos(Math.min(1, Math.max(-1, dot(a, b))));

/** Limits for "no unexpected jumps" (per frame at 30 fps). */
const LIMITS = {position: 0.1, target: 0.02, viewAngleDeg: 0.5, fovDeg: 0.1, positionAccel: 0.004};

describe('C003.2 camera rig', () => {
	it('is a pure function of the frame (repeatable, order independent)', () => {
		const order = [899, 0, 450, 149, 150, 450];
		expect(order.map((f) => cameraAt(f))).toEqual(order.map((f) => frames[f]));
	});

	it('produces finite values on every frame', () => {
		for (const c of frames) {
			expect([...c.position, ...c.target, ...c.up, c.fov].every(Number.isFinite)).toBe(true);
		}
	});

	it('ACT I camera is fixed', () => {
		for (let f = 1; f <= 149; f++) expect(frames[f]).toEqual(frames[0]);
	});

	it('ACT II pushes in, ACT IV pulls back, ACT V ends frontal', () => {
		expect(frames[329].distance).toBeLessThan(frames[150].distance);
		expect(frames[749].distance).toBeGreaterThan(frames[540].distance);
		for (let f = 840; f < 900; f++) {
			const d = viewDir(f);
			expect(d[0]).toBeCloseTo(0, 12);
			expect(d[1]).toBeCloseTo(0, 12);
			expect(d[2]).toBeCloseTo(-1, 12);
			expect(frames[f].up).toEqual([0, 1, 0]);
		}
	});

	it('ACT III orbit is small-angle (< 30°)', () => {
		const az = frames.slice(330, 540).map((c) => c.azimuth);
		expect((Math.max(...az) - Math.min(...az)) * (180 / Math.PI)).toBeLessThan(30);
	});

	it('has no jumps: per-frame steps and accelerations are bounded everywhere', () => {
		const max = {position: 0, target: 0, viewAngleDeg: 0, fovDeg: 0, positionAccel: 0};
		for (let f = 1; f < FILM_DURATION_IN_FRAMES; f++) {
			max.position = Math.max(max.position, distance(frames[f].position, frames[f - 1].position));
			max.target = Math.max(max.target, distance(frames[f].target, frames[f - 1].target));
			max.viewAngleDeg = Math.max(max.viewAngleDeg, angle(viewDir(f), viewDir(f - 1)) * (180 / Math.PI));
			max.fovDeg = Math.max(max.fovDeg, Math.abs(frames[f].fov - frames[f - 1].fov));
			if (f < FILM_DURATION_IN_FRAMES - 1) {
				const acc = distance(
					sub(frames[f + 1].position, frames[f].position),
					sub(frames[f].position, frames[f - 1].position),
				);
				max.positionAccel = Math.max(max.positionAccel, acc);
			}
		}
		mkdirSync('out/test-logs', {recursive: true});
		writeFileSync('out/test-logs/camera-continuity.json', JSON.stringify({limits: LIMITS, measured: max, keys: CAMERA_KEYS}, null, 2));
		for (const k of Object.keys(LIMITS) as (keyof typeof LIMITS)[]) {
			expect(max[k], k).toBeLessThanOrEqual(LIMITS[k]);
		}
	});

	it('is at rest (zero velocity) at every act boundary', () => {
		for (const a of ACTS.slice(1)) {
			const b = a.start - 1; // boundary keyframe sits on the last frame of the previous act
			const v = distance(frames[b + 1].position, frames[b - 1].position) / 2;
			expect(v).toBeLessThan(1e-3);
		}
	});
});
