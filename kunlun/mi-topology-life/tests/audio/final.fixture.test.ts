/**
 * Ground truth for scripts/qc-final.mjs: P-protocol peak times, final caption
 * opacity per frame, and anchor screen positions (projected with the camera
 * rig) around selected pulses, all from the kernel / film code.
 */
import {mkdirSync, writeFileSync} from 'node:fs';
import {expect, it} from 'vitest';
import {audioIdentityFromSpec, pulsePeakTimes} from '../../src/audio/identity';
import {FILM} from '../../src/config/film';
import {FILM_SPEC, filmStateAt} from '../../src/film/choreography';
import {FINAL_CAPTION_TIMING, finalCaptionOpacity} from '../../src/final/captionTiming';
import {cross, dot, normalize, sub, type Vec3} from '../../src/geometry/vec3';
import {identityFingerprint} from '../../src/identity/miKernel';

const project = (frame: number, X: Vec3): [number, number] => {
	const cam = filmStateAt(frame).camera;
	const f = normalize(sub(cam.target, cam.position));
	const r = normalize(cross(f, cam.up));
	const u = cross(r, f);
	const d = sub(X, cam.position);
	const zc = dot(d, f);
	const tanHalf = Math.tan(((cam.fov / 2) * Math.PI) / 180);
	const ndcX = dot(d, r) / (zc * tanHalf * (FILM.width / FILM.height));
	const ndcY = dot(d, u) / (zc * tanHalf);
	return [((ndcX + 1) / 2) * FILM.width, ((1 - ndcY) / 2) * FILM.height];
};

it('writes out/test-logs/final-fixture.json', () => {
	const audio = audioIdentityFromSpec(FILM_SPEC);
	const peaks = audio.voices.map((v, i) => ({id: v.id, pitchHz: v.pitchHz, times: pulsePeakTimes(FILM_SPEC, i, 30)}));
	// Visual sync probes: pulses where the camera is still (ACT I, ACT V hold).
	const probes = [
		{anchor: 'A1', time: 3.375},
		{anchor: 'A1', time: 27.375},
		{anchor: 'A2', time: 28.375},
		{anchor: 'A3', time: 29.375},
	].map((p) => {
		const centre = Math.round(p.time * FILM.fps);
		const frames = Array.from({length: 25}, (_, k) => centre - 12 + k).filter((f) => f >= 0 && f < 900);
		return {
			...p,
			frames: frames.map((f) => ({
				frame: f,
				anchors: Object.fromEntries(filmStateAt(f).anchors.map((a) => [a.id, project(f, a.world)])),
			})),
		};
	});
	const fixture = {
		fingerprint: identityFingerprint(FILM_SPEC),
		spec: {
			anchorIds: FILM_SPEC.anchors.map((a) => a.id),
			phaseOffsets: FILM_SPEC.pulse.phaseOffsets,
			periodSeconds: FILM_SPEC.pulse.periodSeconds,
			width: FILM_SPEC.pulse.width,
			seed: FILM_SPEC.seed,
		},
		audio,
		peaks,
		caption: {timing: FINAL_CAPTION_TIMING, opacity: Array.from({length: 900}, (_, f) => finalCaptionOpacity(f))},
		probes,
	};
	expect(probes[0].frames[12].frame).toBe(101);
	mkdirSync('out/test-logs', {recursive: true});
	writeFileSync('out/test-logs/final-fixture.json', JSON.stringify(fixture, null, 2));
});
