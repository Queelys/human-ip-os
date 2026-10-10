/**
 * Writes the kernel's expected debugger state for a few cases to
 * out/test-logs/debugger-expected.json. scripts/verify-debugger.mjs drives
 * the real browser UI into the same cases and compares, so the bundled
 * debugger is checked against the Node-side kernel (not by eye).
 */
import {mkdirSync, writeFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {FILM} from '../src/config/film';
import {anchorStates} from '../src/identity/anchors';
import {DEFAULT_MI_SPEC, identityFingerprint} from '../src/identity/miKernel';
import {
	DEFAULT_DEFORMATION_PARAMS,
	type DeformationParams,
	deformationFromParams,
	motionParamsAt,
} from '../src/motion/deformation';
import {pulseIntensities} from '../src/motion/pulse';

const spec = DEFAULT_MI_SPEC;

const CASES: {name: string; frame: number; followMotion: boolean; params: DeformationParams}[] = [
	{name: 'default', frame: 0, followMotion: false, params: DEFAULT_DEFORMATION_PARAMS},
	{name: 'manual', frame: 123, followMotion: false, params: {yaw: 0.8, pitch: -0.3, roll: 0.2, scale: 1.6, twist: -1.2}},
	{name: 'motion-f150', frame: 150, followMotion: true, params: DEFAULT_DEFORMATION_PARAMS},
	{name: 'motion-f450', frame: 450, followMotion: true, params: DEFAULT_DEFORMATION_PARAMS},
	{name: 'motion-f899', frame: 899, followMotion: true, params: DEFAULT_DEFORMATION_PARAMS},
];

describe('debugger fixtures', () => {
	it('writes expected anchor states for the browser check', () => {
		const cases = CASES.map((c) => {
			const t = c.frame / FILM.fps;
			const params = c.followMotion ? motionParamsAt(spec, t) : c.params;
			const anchors = anchorStates(spec, deformationFromParams(spec, params)).map((a) => ({id: a.id, s: a.s, world: a.world}));
			return {...c, inputParams: c.params, params, anchors, pulses: pulseIntensities(spec, t)};
		});
		expect(cases).toHaveLength(5);
		mkdirSync('out/test-logs', {recursive: true});
		writeFileSync(
			'out/test-logs/debugger-expected.json',
			JSON.stringify({version: spec.version, seed: spec.seed, fingerprint: identityFingerprint(spec), cases}, null, 2),
		);
	});
});
