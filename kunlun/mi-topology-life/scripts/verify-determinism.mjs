/**
 * Determinism check: render the same frames multiple times in separate
 * Remotion processes, in different orders, and compare decoded-pixel hashes.
 */
import {existsSync, mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {COMPOSITION, ENTRY, pixelHash, report, run} from './lib.mjs';

const OUT = 'out/determinism';
mkdirSync(OUT, {recursive: true});

const FRAMES = [0, 45, 89];
// Pass A renders in ascending order, pass B in descending order.
const passes = {A: FRAMES, B: [...FRAMES].reverse()};

const hashes = {};
for (const [pass, order] of Object.entries(passes)) {
	for (const frame of order) {
		const file = join(OUT, `f${String(frame).padStart(3, '0')}-${pass}.png`);
		run('npx', ['remotion', 'still', ENTRY, COMPOSITION, file, `--frame=${frame}`, '--log=error'], {
			stdio: ['ignore', 'ignore', 'pipe'],
		});
		hashes[`${frame}${pass}`] = pixelHash(file);
		console.log(`rendered frame ${frame} pass ${pass}: ${hashes[`${frame}${pass}`]}`);
	}
}

const rows = FRAMES.map((f) => [
	`frame ${f}: pass A == pass B`,
	hashes[`${f}A`] === hashes[`${f}B`],
	hashes[`${f}A`].slice(0, 16),
]);
rows.push([
	'frames differ (motion present)',
	new Set(FRAMES.map((f) => hashes[`${f}A`])).size === FRAMES.length,
	'0 ≠ 45 ≠ 89',
]);

// Whole-video check: re-render the MP4 and compare all decoded frames with the
// primary render from `npm run render:test`.
const PRIMARY = 'out/c001-render-test.mp4';
if (existsSync(PRIMARY)) {
	const rerun = join(OUT, 'c001-rerun.mp4');
	run('npx', ['remotion', 'render', ENTRY, COMPOSITION, rerun, '--log=error'], {
		stdio: ['ignore', 'ignore', 'pipe'],
	});
	const a = pixelHash(PRIMARY);
	const b = pixelHash(rerun);
	rows.push(['mp4 re-render: all 90 frames equal', a === b, `${a.slice(0, 16)} vs ${b.slice(0, 16)}`]);
} else {
	rows.push(['mp4 re-render', false, `${PRIMARY} missing — run npm run render:test first`]);
}

process.exit(report(rows) ? 0 : 1);
