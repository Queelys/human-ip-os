/**
 * C005 TASK 01 — frame-level QC of the actual final master (all 900 frames).
 *
 * Per frame: decoded-frame MD5 (ffmpeg framemd5); luma mean/min/max, mean
 * |ΔY| vs the previous frame and count of pixels changing by > 8 levels,
 * computed directly from the streamed decoded frames. Audio:
 * short-term loudness (ebur128, 3 s window, 100 ms grid) for continuity.
 *
 * Flags (each reported with frame numbers):
 *  - BLACK      : YMAX ≤ 25 (nothing visible). Allowed only in the designed
 *                 ACT I fade-from-black window (frames 0–149).
 *  - DUPLICATE  : identical decoded MD5 to the previous frame. Allowed only
 *                 where the scene is static by design (see EXPECTED_STATIC).
 *  - LUMA_JUMP  : |ΔYAVG| > max(1.0, 6 × local median |ΔYAVG| over ±15 f).
 *  - DIFF_SPIKE : mean |ΔY| > max(2.0, 6 × local median over ±15 f).
 *
 * Outputs: out/c005/frame-qc.csv, out/c005/frame-qc.json
 */
import {spawn, spawnSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {report} from './lib.mjs';

const MASTER = process.argv[2] ?? 'renders/masters/mi-final-1080p.mp4';
const plan = JSON.parse(readFileSync('out/test-logs/film-plan.json', 'utf8'));
const FPS = 30;
const DESIGN_BLACK = [0, 149];

const ff = (args) => {
	const r = spawnSync('ffmpeg', args, {encoding: 'utf8', maxBuffer: 1 << 28});
	if (r.status !== 0) throw new Error(r.stderr);
	return r;
};

// framemd5 of decoded video frames.
const md5s = ff(['-v', 'error', '-i', MASTER, '-map', '0:v:0', '-f', 'framemd5', '-'])
	.stdout.split('\n')
	.filter((l) => l && !l.startsWith('#'))
	.map((l) => l.split(',').map((x) => x.trim()).pop());

// Per-frame luma statistics computed directly from the decoded frames
// (gray, 8-bit), streamed so all 900 frames are analysed. ffmpeg's
// signalstats YDIF was found to misreport frame differences on this content
// (e.g. 9.5 at f138 where the measured mean |ΔY| is 0.0001), so it is not used.
const W = 1920;
const H = 1080;
const FRAME = W * H;
const stats = await new Promise((resolve, reject) => {
	const proc = spawn('ffmpeg', ['-v', 'error', '-i', MASTER, '-map', '0:v:0', '-f', 'rawvideo', '-pix_fmt', 'gray', '-']);
	const out = [];
	let prev = null;
	let buf = Buffer.alloc(0);
	proc.stdout.on('data', (chunk) => {
		buf = Buffer.concat([buf, chunk]);
		while (buf.length >= FRAME) {
			const f = buf.subarray(0, FRAME);
			let sum = 0;
			let min = 255;
			let max = 0;
			let diff = 0;
			let changed = 0;
			for (let i = 0; i < FRAME; i++) {
				const v = f[i];
				sum += v;
				if (v < min) min = v;
				if (v > max) max = v;
				if (prev) {
					const d = Math.abs(v - prev[i]);
					diff += d;
					if (d > 8) changed++;
				}
			}
			out.push({frame: out.length, YAVG: sum / FRAME, YMIN: min, YMAX: max, YDIF: prev ? diff / FRAME : 0, changedPx: changed});
			prev = Buffer.from(f);
			buf = buf.subarray(FRAME);
		}
	});
	proc.on('error', reject);
	proc.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`ffmpeg exited ${code}`))));
});

// Short-term loudness on a 100 ms grid.
ff(['-v', 'error', '-i', MASTER, '-map', '0:a:0', '-af', 'ebur128=metadata=1,ametadata=print:key=lavfi.r128.S:file=out/c005/ebur128-S.txt', '-f', 'null', '-']);
const shortTerm = [];
let t = null;
for (const line of readFileSync('out/c005/ebur128-S.txt', 'utf8').split('\n')) {
	const m = line.match(/pts_time:([\d.]+)/);
	if (m) t = Number(m[1]);
	const s = line.match(/lavfi\.r128\.S=(-?[\d.]+|-inf)/);
	if (s && t !== null) shortTerm.push({t, S: s[1] === '-inf' ? -Infinity : Number(s[1])});
}

const N = stats.length;
const actOf = (f) => plan.acts.find((a) => f >= a.start && f <= a.end);
const median = (xs) => {
	const s = [...xs].sort((a, b) => a - b);
	return s.length ? s[Math.floor(s.length / 2)] : 0;
};
const dY = stats.map((s, i) => (i === 0 ? 0 : Math.abs(s.YAVG - stats[i - 1].YAVG)));

// Frames where the picture is expected to be static by design: the ACT I
// fixed camera before anything is visible, and the ACT V hold — determined
// empirically below and only *accepted* if they fall in these windows.
const EXPECTED_STATIC = [
	[0, 20], // black open, nothing visible yet
];

const rows = stats.map((s, i) => {
	const lo = Math.max(1, i - 15);
	const hi = Math.min(N - 1, i + 15);
	const localDY = median(dY.slice(lo, hi + 1));
	const localDiff = median(stats.slice(lo, hi + 1).map((x) => x.YDIF ?? 0));
	const flags = [];
	if (s.YMAX <= 25) flags.push('BLACK');
	if (i > 0 && md5s[i] === md5s[i - 1]) flags.push('DUPLICATE');
	if (i > 0 && dY[i] > Math.max(1.0, 6 * localDY)) flags.push('LUMA_JUMP');
	if (i > 0 && (s.YDIF ?? 0) > Math.max(2.0, 6 * localDiff)) flags.push('DIFF_SPIKE');
	return {frame: i, time: +(i / FPS).toFixed(4), act: actOf(i).id, YAVG: s.YAVG, YMIN: s.YMIN, YMAX: s.YMAX, YDIF: s.YDIF, changedPx: s.changedPx, dYAVG: +dY[i].toFixed(4), md5: md5s[i], flags};
});

const inAny = (f, wins) => wins.some(([a, b]) => f >= a && f <= b);
const black = rows.filter((r) => r.flags.includes('BLACK')).map((r) => r.frame);
const dups = rows.filter((r) => r.flags.includes('DUPLICATE')).map((r) => r.frame);
const jumps = rows.filter((r) => r.flags.includes('LUMA_JUMP')).map((r) => r.frame);
const spikes = rows.filter((r) => r.flags.includes('DIFF_SPIKE')).map((r) => r.frame);
const unexpectedBlack = black.filter((f) => f < DESIGN_BLACK[0] || f > DESIGN_BLACK[1]);
const unexpectedDups = dups.filter((f) => !inAny(f, EXPECTED_STATIC));

// Act-boundary continuity (picture + sound).
const boundaries = plan.transitions.map((tr) => {
	const b = tr.frame;
	const stAt = (sec) => shortTerm.reduce((best, x) => (Math.abs(x.t - sec) < Math.abs(best.t - sec) ? x : best), shortTerm[0]).S;
	return {
		from: tr.from,
		to: tr.to,
		frame: b,
		dYAVG_across: rows[b].dYAVG,
		dYAVG_neighbours: [rows[b - 1].dYAVG, rows[b + 1].dYAVG],
		YDIF_across: rows[b].YDIF,
		YDIF_neighbours: [rows[b - 1].YDIF, rows[b + 1].YDIF],
		shortTermLufs: {before: stAt(b / FPS - 0.2), at: stAt(b / FPS), after: stAt(b / FPS + 0.2)},
	};
});
// Only audible readings: above the BS.1770 absolute gate (−70 LUFS). Below it
// ebur128 reports a floor value (−120.7) during the designed silent fade-in.
const finiteS = shortTerm.filter((x) => Number.isFinite(x.S) && x.S > -70);
let maxSJump = 0;
let maxSJumpAt = 0;
for (let i = 1; i < finiteS.length; i++) {
	const d = Math.abs(finiteS[i].S - finiteS[i - 1].S);
	if (d > maxSJump) {
		maxSJump = d;
		maxSJumpAt = finiteS[i].t;
	}
}

writeFileSync(
	'out/c005/frame-qc.csv',
	['frame,time,act,YAVG,YMIN,YMAX,meanAbsDiff,changedPx,dYAVG,md5,flags', ...rows.map((r) => [r.frame, r.time, r.act, r.YAVG.toFixed(4), r.YMIN, r.YMAX, r.YDIF.toFixed(5), r.changedPx, r.dYAVG, r.md5, r.flags.join('|')].join(','))].join('\n') + '\n',
);
const summary = {master: MASTER, frames: N, md5Count: md5s.length, black, dups, jumps, spikes, unexpectedBlack, unexpectedDups, expectedStatic: EXPECTED_STATIC, boundaries, shortTerm: {points: shortTerm.length, maxStepLu: maxSJump, maxStepAt: maxSJumpAt}};
writeFileSync('out/c005/frame-qc.json', JSON.stringify({summary, rows}, null, 2));

const span = (fs) => (fs.length ? `${fs.length}: ${fs.slice(0, 12).join(',')}${fs.length > 12 ? '…' : ''}` : '0');
const ok = report([
	['decoded all frames', N === 900 && md5s.length === 900, `${N} decoded frames analysed, ${md5s.length} framemd5`],
	['no black frames outside designed ACT I window', unexpectedBlack.length === 0, `black ${span(black)}; outside ${span(unexpectedBlack)}`],
	['no unexpected duplicate frames', unexpectedDups.length === 0, `duplicates ${span(dups)}; unexpected ${span(unexpectedDups)}`],
	['no abnormal luma jumps', jumps.length === 0, span(jumps)],
	['no frame-difference spikes', spikes.length === 0, span(spikes)],
	['short-term loudness continuous (audible region, no step > 3 LU per 100 ms)', maxSJump <= 3, `max step ${maxSJump.toFixed(2)} LU at ${maxSJumpAt.toFixed(1)} s`],
]);
process.exit(ok ? 0 : 1);
