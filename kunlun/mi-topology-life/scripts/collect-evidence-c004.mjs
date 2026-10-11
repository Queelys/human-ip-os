/** Copy C004 evidence into docs/evidence/c004/. */
import {cpSync, existsSync, mkdirSync, readdirSync, rmSync} from 'node:fs';
import {join} from 'node:path';

const DEST = 'docs/evidence/c004';
rmSync(DEST, {recursive: true, force: true});
mkdirSync(join(DEST, 'render-logs'), {recursive: true});
const items = [
	['out/test-logs/vitest.txt', 'vitest.txt'],
	['out/test-logs/vitest.json', 'vitest.json'],
	['out/test-logs/final-fixture.json', 'final-fixture.json'],
	['out/audio/audio-report.json', 'audio-report.json'],
	['out/logs/audio-determinism.json', 'audio-determinism.json'],
	['out/logs/qc-final.json', 'qc-final.json'],
	['out/logs/ffprobe-final.json', 'ffprobe-final.json'],
	['out/logs/integration.json', 'integration.json'],
	['out/logs/verify-film.json', 'verify-film.json'],
];
for (const [from, to] of items) {
	if (!existsSync(from)) {
		console.error(`missing ${from}`);
		process.exit(1);
	}
	cpSync(from, join(DEST, to));
	console.log(`${from} → ${DEST}/${to}`);
}
for (const f of readdirSync('out/logs').filter((n) => /^(render-final|qc-stills).*\.(json|txt)$/.test(n))) {
	cpSync(join('out/logs', f), join(DEST, 'render-logs', f));
}
mkdirSync(join(DEST, 'qc-frames'), {recursive: true});
for (const f of [845, 855, 892]) cpSync(`out/qc/final/f${f}.png`, join(DEST, 'qc-frames', `final-f${f}.png`));
if (existsSync('out/acceptance-c004.log')) cpSync('out/acceptance-c004.log', join(DEST, 'acceptance-c004.log'));
console.log('done');
