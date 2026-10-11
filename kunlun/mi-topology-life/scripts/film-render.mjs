/**
 * C003.7 film renderer (Remotion programmatic API, against the `npm run build`
 * bundle). Captures every browser console message and FAILS on any error, or
 * any message mentioning WebGL / GL_INVALID / THREE — so "no WebGL errors" is
 * checked on every rendered frame, not assumed.
 *
 *   node scripts/film-render.mjs stills --out <dir> --frames 0,101,... [--props JSON] [--tag name]
 *   node scripts/film-render.mjs video  --out <file.mp4> [--scale 0.5] [--tag name]
 *   (--composition MI-Film | MI-Final; default MI-Film)
 *
 * Logs: out/logs/<tag>.json (all browser messages, timings, settings).
 */
import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {parseArgs} from 'node:util';
import {openBrowser, renderMedia, renderStill, selectComposition} from '@remotion/renderer';

const {positionals, values} = parseArgs({
	allowPositionals: true,
	options: {
		out: {type: 'string'},
		frames: {type: 'string'},
		props: {type: 'string', default: '{}'},
		scale: {type: 'string', default: '1'},
		tag: {type: 'string'},
		concurrency: {type: 'string', default: '3'},
		composition: {type: 'string', default: 'MI-Film'},
	},
});
const mode = positionals[0];
const SERVE_URL = 'build';
const COMPOSITION = values.composition;
const tag = values.tag ?? `${mode}-${Date.now()}`;
const inputProps = {...(COMPOSITION === 'MI-Film' ? {captionEnabled: true} : {}), ...JSON.parse(values.props)};
// The real browser comes from REMOTION_BROWSER_EXECUTABLE; it is launched via
// scripts/chrome-swiftshader.sh, which opts in to SwiftShader explicitly.
if (!process.env.REMOTION_BROWSER_EXECUTABLE) {
	throw new Error('Set REMOTION_BROWSER_EXECUTABLE to a headless Chromium binary');
}
process.env.MI_CHROME_BIN = process.env.REMOTION_BROWSER_EXECUTABLE;
const browserExecutable = resolve('scripts/chrome-swiftshader.sh');
const chromiumOptions = {gl: 'swangle'};

const logs = [];
const BAD = /webgl|gl_invalid|gl error|three\.|swiftshader/i;
/**
 * Exact library notices that are known, understood and not WebGL errors.
 * They are still recorded in the log and printed as LIB-ALLOWED.
 */
const LIB_ALLOWED = [
	// @react-three/fiber 9.7.0 constructs THREE.Clock in its store; three 0.186 marks it deprecated.
	'THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.',
];
const onBrowserLog = (log) => logs.push({type: log.type, text: log.text});
const allowed = (l) => l.type !== 'error' && LIB_ALLOWED.includes(l.text);
const badLogs = () => logs.filter((l) => !allowed(l) && (l.type === 'error' || BAD.test(l.text)));

const writeLog = (extra) => {
	mkdirSync('out/logs', {recursive: true});
	const file = join('out/logs', `${tag}.json`);
	writeFileSync(
		file,
		JSON.stringify(
			{tag, mode, inputProps, scale: Number(values.scale), browser: process.env.MI_CHROME_BIN, launcher: browserExecutable, chromiumOptions, ...extra, libAllowed: LIB_ALLOWED, browserLogs: logs, badLogs: badLogs()},
			null,
			2,
		),
	);
	return file;
};

const started = Date.now();
const browser = await openBrowser('chrome', {browserExecutable, chromiumOptions, logLevel: 'error'});
try {
	const composition = await selectComposition({serveUrl: SERVE_URL, id: COMPOSITION, inputProps, puppeteerInstance: browser, onBrowserLog, chromiumOptions, logLevel: 'error'});
	const meta = {id: composition.id, width: composition.width, height: composition.height, fps: composition.fps, durationInFrames: composition.durationInFrames};
	console.log(`composition ${JSON.stringify(meta)}`);

	if (mode === 'stills') {
		const frames = values.frames.split(',').map(Number);
		mkdirSync(values.out, {recursive: true});
		const results = [];
		for (const frame of frames) {
			const output = join(values.out, `f${String(frame).padStart(3, '0')}.png`);
			const t0 = Date.now();
			await renderStill({composition, serveUrl: SERVE_URL, frame, output, inputProps, imageFormat: 'png', puppeteerInstance: browser, onBrowserLog, chromiumOptions, scale: Number(values.scale), overwrite: true, logLevel: 'error'});
			results.push({frame, output, ms: Date.now() - t0});
			console.log(`still f${frame} → ${output} (${Date.now() - t0} ms)`);
		}
		const file = writeLog({composition: meta, results, totalMs: Date.now() - started});
		console.log(`log: ${file}`);
	} else if (mode === 'video') {
		mkdirSync(dirname(values.out), {recursive: true});
		let last = -1;
		await renderMedia({
			composition,
			serveUrl: SERVE_URL,
			codec: 'h264',
			outputLocation: values.out,
			inputProps,
			imageFormat: 'png',
			pixelFormat: 'yuv420p',
			crf: 18,
			muted: true,
			scale: Number(values.scale),
			concurrency: Number(values.concurrency),
			puppeteerInstance: browser,
			onBrowserLog,
			chromiumOptions,
			overwrite: true,
			logLevel: 'error',
			onProgress: ({progress}) => {
				const pct = Math.floor(progress * 10);
				if (pct !== last) {
					last = pct;
					console.log(`render ${values.out}: ${pct * 10}% (${Math.round((Date.now() - started) / 1000)} s)`);
				}
			},
		});
		const file = writeLog({composition: meta, output: values.out, totalMs: Date.now() - started});
		console.log(`log: ${file}`);
	} else {
		throw new Error(`unknown mode ${mode}`);
	}
} finally {
	await browser.close({silent: true});
}

const bad = badLogs();
const libAllowed = [...new Set(logs.filter(allowed).map((l) => l.text))];
for (const t of libAllowed) console.log(`LIB-ALLOWED (${logs.filter((l) => l.text === t).length}×): ${t}`);
console.log(`browser messages: ${logs.length}, error/WebGL messages: ${bad.length}`);
if (bad.length > 0) {
	for (const b of bad.slice(0, 20)) console.error(`  [${b.type}] ${b.text}`);
	process.exit(1);
}
