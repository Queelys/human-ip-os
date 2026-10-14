/** Copy C005 QC evidence into docs/evidence/c005/. */
import {cpSync, existsSync, mkdirSync, rmSync} from 'node:fs';
import {join} from 'node:path';

const DEST = 'docs/evidence/c005';
rmSync(DEST, {recursive: true, force: true});
mkdirSync(DEST, {recursive: true});
const items = [
	['out/c005/ffprobe.json', 'ffprobe.json'],
	['out/c005/frame-qc.csv', 'frame-qc.csv'],
	['out/c005/frame-qc.json', 'frame-qc.json'],
	['out/c005/identity-check.json', 'identity-check.json'],
	['out/logs/qc-final.json', 'qc-final.json'],
	['out/logs/integration.json', 'integration.json'],
	['out/test-logs/vitest.txt', 'vitest.txt'],
	['out/test-logs/camera-continuity.json', 'camera-continuity.json'],
	['out/test-logs/envelope-continuity.json', 'envelope-continuity.json'],
];
for (const [from, to] of items) {
	if (!existsSync(from)) {
		console.error(`missing ${from}`);
		process.exit(1);
	}
	cpSync(from, join(DEST, to));
}
if (existsSync('out/c005-qc.log')) cpSync('out/c005-qc.log', join(DEST, 'c005-qc.log'));
console.log(`evidence → ${DEST}`);
