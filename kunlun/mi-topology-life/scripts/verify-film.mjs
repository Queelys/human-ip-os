/**
 * C003 render smoke tests (run after `npm test` and `npm run build`):
 *  1. Stills: first / representative / last frame of every act (+ boundary
 *     neighbours and caption probes), via film-render.mjs (fails on any
 *     browser error or WebGL message).
 *  2. Determinism: a second, separate render process renders a subset in
 *     reverse order; decoded-pixel SHA-256 must match.
 *  3. Caption: pixel diff of caption-on vs caption-off renders — absent before
 *     28 s, present after, bounding box inside the title-safe area, centred.
 *  4. Transitions: pixel change across each act boundary is in line with the
 *     neighbouring frame-to-frame changes (no visual jump / hard cut).
 * Report: out/logs/verify-film.json
 */
import {spawnSync} from 'node:child_process';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {decodeRgba, meanAbsDiff, meanLuma, pixelHash, report} from './lib.mjs';

const plan = JSON.parse(readFileSync('out/test-logs/film-plan.json', 'utf8'));
const OUT = 'out/film';
mkdirSync('out/logs', {recursive: true});

const render = (dir, frames, tag, props) => {
	const args = ['scripts/film-render.mjs', 'stills', '--out', dir, '--frames', frames.join(','), '--tag', tag];
	if (props) args.push('--props', JSON.stringify(props));
	const res = spawnSync('node', args, {encoding: 'utf8'});
	writeFileSync(`out/logs/${tag}.stdout.txt`, `${res.stdout}\n${res.stderr}`);
	if (res.status !== 0) throw new Error(`render ${tag} failed:\n${res.stdout}\n${res.stderr}`);
	return JSON.parse(readFileSync(`out/logs/${tag}.json`, 'utf8'));
};
const file = (dir, f) => join(dir, `f${String(f).padStart(3, '0')}.png`);

// 1. Stills set A.
const boundaryFrames = plan.transitions.flatMap((t) => [t.frame - 2, t.frame - 1, t.frame, t.frame + 1]);
const actFrames = plan.acts.flatMap((a) => [a.start, a.representative, a.end]);
const captionFrames = [830, plan.caption.start, plan.caption.start + 6, 885, 899];
const framesA = [...new Set([...actFrames, ...boundaryFrames, ...captionFrames])].sort((a, b) => a - b);
const logA = render(join(OUT, 'stills'), framesA, 'stills-A');

// 2. Determinism: separate process, reverse order.
const framesB = [...plan.acts.map((a) => a.representative), 149, 150, 899].sort((a, b) => b - a);
const logB = render(join(OUT, 'stills-B'), framesB, 'stills-B');
const determinism = framesB.map((f) => {
	const a = pixelHash(file(join(OUT, 'stills'), f));
	const b = pixelHash(file(join(OUT, 'stills-B'), f));
	return {frame: f, a, b, equal: a === b};
});

// 3. Caption on/off diff.
const logC = render(join(OUT, 'caption-off'), captionFrames, 'stills-caption-off', {captionEnabled: false});
const {titleSafe} = plan;
const captionChecks = captionFrames.map((f) => {
	const on = decodeRgba(file(join(OUT, 'stills'), f));
	const off = decodeRgba(file(join(OUT, 'caption-off'), f));
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -1;
	let maxY = -1;
	let count = 0;
	for (let y = 0; y < on.height; y++) {
		for (let x = 0; x < on.width; x++) {
			const i = (y * on.width + x) * 4;
			const d = Math.abs(on.data[i] - off.data[i]) + Math.abs(on.data[i + 1] - off.data[i + 1]) + Math.abs(on.data[i + 2] - off.data[i + 2]);
			if (d > 24) {
				count++;
				minX = Math.min(minX, x);
				maxX = Math.max(maxX, x);
				minY = Math.min(minY, y);
				maxY = Math.max(maxY, y);
			}
		}
	}
	return {frame: f, changedPixels: count, bbox: count ? {minX, minY, maxX, maxY} : null};
});

// 4. Boundary continuity.
const transitions = plan.transitions.map((t) => {
	const img = (f) => decodeRgba(file(join(OUT, 'stills'), f));
	const [p2, p1, b0, b1] = [t.frame - 2, t.frame - 1, t.frame, t.frame + 1].map(img);
	const before = meanAbsDiff(p2, p1);
	const across = meanAbsDiff(p1, b0);
	const after = meanAbsDiff(b0, b1);
	return {from: t.from, to: t.to, frame: t.frame, type: t.type, diffBefore: before, diffAcross: across, diffAfter: after, lumaLast: meanLuma(p1), lumaFirst: meanLuma(b0)};
});

const rows = [
	['stills rendered (no error/WebGL logs)', logA.badLogs.length === 0 && logA.results.length === framesA.length, `${framesA.length} frames, bad logs ${logA.badLogs.length}`],
	['composition 1920×1080 @30fps, 900 frames', logA.composition.width === 1920 && logA.composition.height === 1080 && logA.composition.fps === 30 && logA.composition.durationInFrames === 900, JSON.stringify(logA.composition)],
	...determinism.map((d) => [`determinism f${d.frame} (separate process, reversed)`, d.equal, d.a.slice(0, 16)]),
	['second render process clean', logB.badLogs.length === 0 && logC.badLogs.length === 0, `bad logs ${logB.badLogs.length + logC.badLogs.length}`],
];
for (const c of captionChecks) {
	if (c.frame <= plan.caption.start) {
		rows.push([`caption absent at f${c.frame}`, c.changedPixels === 0, `${c.changedPixels} px differ`]);
	} else {
		const b = c.bbox;
		const inSafe = b && b.minX >= titleSafe.left && b.maxX <= titleSafe.right && b.minY >= titleSafe.top && b.maxY <= titleSafe.bottom;
		const centred = b && Math.abs((b.minX + b.maxX) / 2 - plan.film.width / 2) < 24;
		const wide = b && b.maxX - b.minX > 500;
		rows.push([`caption visible + in title-safe at f${c.frame}`, Boolean(c.changedPixels > 1000 && inSafe && centred && wide), b ? `${c.changedPixels} px, bbox x${b.minX}–${b.maxX} y${b.minY}–${b.maxY}` : 'none']);
	}
}
for (const t of transitions) {
	const ok = t.type === 'continuous' && t.diffAcross <= 2 * Math.max(t.diffBefore, t.diffAfter) + 0.5;
	rows.push([`transition ${t.from}→${t.to} @${t.frame} continuous`, ok, `Δ before ${t.diffBefore.toFixed(3)}, across ${t.diffAcross.toFixed(3)}, after ${t.diffAfter.toFixed(3)}`]);
}

writeFileSync('out/logs/verify-film.json', JSON.stringify({rows, determinism, captionChecks, transitions, framesA, framesB}, null, 2));
process.exit(report(rows) ? 0 : 1);
