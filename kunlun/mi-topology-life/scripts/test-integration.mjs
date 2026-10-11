/**
 * C003 integration tests (run after `npm run build`):
 *  1. Identity freeze: C002 identity source files are unchanged since the C002
 *     acceptance commit (git), so the film cannot have edited the kernel.
 *  2. Bundle metadata: compositions read from the built bundle have the exact
 *     spec (MI-Film 1920×1080 @30fps, 900 frames; C001 unchanged).
 *  3. Studio preview: the built Studio opens MI-Film in headless Chromium with
 *     WebGL, no console errors and no WebGL warnings.
 * Report: out/logs/integration.json
 */
import {execFileSync} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {getCompositions, openBrowser} from '@remotion/renderer';
import {chromium} from 'playwright';
import {report, serveStatic} from './lib.mjs';

const C002_ACCEPTED_COMMIT = '4ec5e9f';
const IDENTITY_PATHS = [
	'src/identity',
	'src/motion',
	'src/geometry/trefoil.ts',
	'src/geometry/neuralGraph.ts',
	'src/geometry/vec3.ts',
	'src/core/rng.ts',
	'src/core/identity.ts',
];
const LIB_ALLOWED = ['THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.'];
const BAD = /webgl|gl_invalid|gl error|three\.|swiftshader/i;
const rows = [];
const details = {};

// 1. Identity freeze.
const diff = execFileSync('git', ['diff', '--stat', C002_ACCEPTED_COMMIT, '--', ...IDENTITY_PATHS], {encoding: 'utf8'}).trim();
const untracked = execFileSync('git', ['status', '--porcelain', '--', ...IDENTITY_PATHS], {encoding: 'utf8'}).trim();
details.identityFreeze = {commit: C002_ACCEPTED_COMMIT, paths: IDENTITY_PATHS, diff, status: untracked};
rows.push(['identity sources unchanged since C002 acceptance', diff === '' && untracked === '', diff || untracked || `clean vs ${C002_ACCEPTED_COMMIT}`]);

// 2. Bundle metadata.
if (!process.env.REMOTION_BROWSER_EXECUTABLE) throw new Error('Set REMOTION_BROWSER_EXECUTABLE');
process.env.MI_CHROME_BIN = process.env.REMOTION_BROWSER_EXECUTABLE;
const browser = await openBrowser('chrome', {browserExecutable: resolve('scripts/chrome-swiftshader.sh'), chromiumOptions: {gl: 'swangle'}, logLevel: 'error'});
try {
	const comps = await getCompositions('build', {puppeteerInstance: browser, logLevel: 'error'});
	const meta = Object.fromEntries(comps.map((c) => [c.id, {width: c.width, height: c.height, fps: c.fps, durationInFrames: c.durationInFrames}]));
	details.compositions = meta;
	const film = meta['MI-Film'];
	rows.push(['bundle: MI-Film 1920×1080 @30fps 900 frames', film?.width === 1920 && film?.height === 1080 && film?.fps === 30 && film?.durationInFrames === 900, JSON.stringify(film)]);
	const c1 = meta['C001-RenderTest'];
	rows.push(['bundle: C001-RenderTest unchanged (90 frames)', c1?.durationInFrames === 90 && c1?.width === 1920, JSON.stringify(c1)]);
} finally {
	await browser.close({silent: true});
}

// 3. Studio preview of MI-Film.
const server = await serveStatic('build', 3131);
const pw = await chromium.launch({args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
try {
	const page = await pw.newPage({viewport: {width: 1600, height: 1000}});
	const msgs = [];
	page.on('console', (m) => msgs.push({type: m.type(), text: m.text()}));
	page.on('pageerror', (e) => msgs.push({type: 'error', text: `pageerror: ${e.message}`}));
	await page.goto('http://localhost:3131/MI-Film', {waitUntil: 'networkidle'});
	await page.waitForSelector('canvas', {timeout: 60_000});
	await page.waitForTimeout(4000);
	const canvas = await page.evaluate(() => {
		const c = globalThis.document.querySelector('canvas');
		return {w: c?.width ?? 0, h: c?.height ?? 0, webgl: Boolean(c?.getContext('webgl2') ?? c?.getContext('webgl'))};
	});
	mkdirSync('out/logs', {recursive: true});
	await page.screenshot({path: 'out/logs/integration-studio-mi-film.png'});
	const bad = msgs.filter((m) => !LIB_ALLOWED.includes(m.text) && (m.type === 'error' || BAD.test(m.text)));
	details.studio = {canvas, messages: msgs, bad};
	rows.push(['studio preview: MI-Film WebGL canvas', canvas.webgl && canvas.w > 0, `${canvas.w}×${canvas.h}`]);
	rows.push(['studio preview: no errors / WebGL warnings', bad.length === 0, bad.length ? bad.map((m) => m.text).join(' | ') : `0 (${msgs.length} messages total)`]);
} finally {
	await pw.close();
	server.stop();
}

writeFileSync('out/logs/integration.json', JSON.stringify({rows, details}, null, 2));
process.exit(report(rows) ? 0 : 1);
