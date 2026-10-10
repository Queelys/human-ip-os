/**
 * Copy verifiable C002 evidence (test logs, property reports, debugger
 * screenshots and checks) from out/ into docs/evidence/c002/ for review.
 */
import {cpSync, existsSync, mkdirSync, rmSync} from 'node:fs';

const DEST = 'docs/evidence/c002';
const items = [
	['out/test-logs/vitest.txt', `${DEST}/vitest.txt`],
	['out/test-logs/vitest.json', `${DEST}/vitest.json`],
	['out/test-logs/property', `${DEST}/property`],
	['out/test-logs/anchor-tracking.json', `${DEST}/anchor-tracking.json`],
	['out/test-logs/debugger-expected.json', `${DEST}/debugger-expected.json`],
	['out/debugger', `${DEST}/debugger`],
];
rmSync(DEST, {recursive: true, force: true});
mkdirSync(DEST, {recursive: true});
for (const [from, to] of items) {
	if (!existsSync(from)) {
		console.error(`missing ${from}`);
		process.exit(1);
	}
	cpSync(from, to, {recursive: true});
	console.log(`${from} → ${to}`);
}
