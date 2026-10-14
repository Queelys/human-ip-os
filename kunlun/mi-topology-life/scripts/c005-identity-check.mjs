/**
 * C005 TASK 01.6 — identity kernel configuration and version consistency.
 * The fingerprint/version computed from the code *now* (via the test fixture)
 * must equal every recorded value: the spec document, the C002 debugger
 * evidence, the C004 audio report and fixture, and the identity sources must
 * be unchanged since the C002 acceptance commit.
 */
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {report} from './lib.mjs';

const json = (f) => JSON.parse(readFileSync(f, 'utf8'));
const now = json('out/test-logs/final-fixture.json'); // computed by `npm test` from current code
const specDoc = readFileSync('docs/MI_IDENTITY_SPEC.md', 'utf8');
const c002 = json('docs/evidence/c002/debugger-expected.json');
const c004Audio = json('docs/evidence/c004/audio-report.json');
const c004Fixture = json('docs/evidence/c004/final-fixture.json');
const C002_ACCEPTED = '4ec5e9f';
const paths = ['src/identity', 'src/motion', 'src/geometry/trefoil.ts', 'src/geometry/neuralGraph.ts', 'src/geometry/vec3.ts', 'src/core/rng.ts', 'src/core/identity.ts'];
const diff = execFileSync('git', ['diff', '--stat', C002_ACCEPTED, '--', ...paths], {encoding: 'utf8'}).trim();

const fp = now.fingerprint;
const docFp = specDoc.match(/身份指纹[^`]*`?\*\*`?([0-9a-f]{16})/)?.[1] ?? specDoc.match(/([0-9a-f]{16})/)?.[1];
const result = {
	current: {fingerprint: fp, version: now.audio.version, seed: now.spec.seed},
	specDocument: {fingerprint: docFp, versionLine: specDoc.match(/MI Identity Spec V([\d.]+)/)?.[1]},
	c002Evidence: {fingerprint: c002.fingerprint, version: c002.version, seed: c002.seed},
	c004AudioReport: {version: c004Audio.identity.version, seed: c004Audio.identity.seed},
	c004Fixture: {fingerprint: c004Fixture.fingerprint},
	identitySourcesDiffSinceC002: diff || '(none)',
};
writeFileSync('out/c005/identity-check.json', JSON.stringify(result, null, 2));
const ok = report([
	['fingerprint: code = spec doc', fp === docFp, `${fp} / ${docFp}`],
	['fingerprint: code = C002 evidence', fp === c002.fingerprint, c002.fingerprint],
	['fingerprint: code = C004 evidence', fp === c004Fixture.fingerprint, c004Fixture.fingerprint],
	['version 1.0.0 everywhere', now.audio.version === '1.0.0' && c002.version === '1.0.0' && c004Audio.identity.version === '1.0.0' && result.specDocument.versionLine === '1.0', `code ${now.audio.version}, C002 ${c002.version}, C004 ${c004Audio.identity.version}, doc V${result.specDocument.versionLine}`],
	['seed 0x4B4C4D49 everywhere', [now.spec.seed, c002.seed, c004Audio.identity.seed].every((s) => s === 0x4b4c4d49), `0x${now.spec.seed.toString(16)}`],
	['identity sources unchanged since C002 acceptance', diff === '', diff || `clean vs ${C002_ACCEPTED}`],
]);
process.exit(ok ? 0 : 1);
