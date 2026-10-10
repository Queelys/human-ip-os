/**
 * C002.7 debugger check (Playwright + headless Chromium, software WebGL).
 * Serves build-debugger/, drives the real UI into each case from
 * out/test-logs/debugger-expected.json (written by `npm test`), compares the
 * page's anchor state with the Node kernel, exercises Reset and an
 * out-of-family parameter, fails on any console error, and saves screenshots
 * to out/debugger/.
 */
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {report, serveStatic} from './lib.mjs';

const EXPECTED = 'out/test-logs/debugger-expected.json';
if (!existsSync('build-debugger/index.html')) throw new Error('build-debugger/ missing — run `npm run build`');
if (!existsSync(EXPECTED)) throw new Error(`${EXPECTED} missing — run \`npm test\``);
const expected = JSON.parse(readFileSync(EXPECTED, 'utf8'));
mkdirSync('out/debugger', {recursive: true});

const PORT = 3202;
const TOL = 1e-9;
const rows = [];
const server = await serveStatic('build-debugger', PORT);
const browser = await chromium.launch({
	executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
	args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
let ok = false;
try {
	const page = await browser.newPage({viewport: {width: 1600, height: 950}});
	const errors = [];
	page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
	page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
	await page.goto(`http://localhost:${PORT}/`, {waitUntil: 'networkidle'});
	await page.waitForSelector('canvas');

	const state = async () => JSON.parse(await page.locator('[data-testid=debug-state]').textContent());
	const setMotion = async (on) => {
		const box = page.getByTestId('toggle-motion');
		if ((await box.isChecked()) !== on) await box.click();
	};
	const fill = async (id, v) => {
		await page.getByTestId(id).fill(String(v));
	};

	// Identity info.
	const s0 = await state();
	const canvas = await page.evaluate(() => {
		const c = globalThis.document.querySelector('canvas');
		return {w: c?.width ?? 0, webgl: Boolean(c?.getContext('webgl2') ?? c?.getContext('webgl'))};
	});
	rows.push(['page loads + WebGL canvas', canvas.webgl && canvas.w > 0, `width ${canvas.w}`]);
	rows.push(['shows identity version', (await page.getByTestId('spec-version').textContent()) === expected.version, expected.version]);
	rows.push(['shows seed', s0.seed === expected.seed && (await page.getByTestId('spec-seed').textContent()) === `0x${expected.seed.toString(16).toUpperCase()}`, `0x${expected.seed.toString(16).toUpperCase()}`]);
	rows.push(['shows fingerprint', (await page.getByTestId('spec-fingerprint').textContent()) === expected.fingerprint, expected.fingerprint]);

	// Cases vs Node kernel.
	const log = [];
	for (const c of expected.cases) {
		await setMotion(c.followMotion);
		await fill('input-frame', c.frame);
		if (!c.followMotion) {
			for (const k of ['yaw', 'pitch', 'roll', 'scale', 'twist']) await fill(`input-${k}`, c.inputParams[k]);
		}
		await page.waitForTimeout(300);
		const st = await state();
		let maxErr = 0;
		let maxInv = 0;
		for (const a of c.anchors) {
			const got = st.anchors.find((x) => x.id === a.id);
			for (let i = 0; i < 3; i++) maxErr = Math.max(maxErr, Math.abs(got.world[i] - a.world[i]));
			maxInv = Math.max(maxInv, got.inverseError);
		}
		const pulseErr = Math.max(...c.anchors.map((a) => Math.abs(st.anchors.find((x) => x.id === a.id).pulse - c.pulses[a.id])));
		const pass = st.frame === c.frame && st.paramsValid && maxErr < TOL && maxInv < TOL && pulseErr < TOL;
		rows.push([`case ${c.name}: anchors = kernel`, pass, `frame ${st.frame}, max|Δ| ${maxErr.toExponential(1)}, inv ${maxInv.toExponential(1)}, pulseΔ ${pulseErr.toExponential(1)}`]);
		await page.screenshot({path: `out/debugger/${c.name}.png`});
		log.push({case: c.name, frame: st.frame, params: st.params, anchors: st.anchors, maxErr, maxInv});
	}

	// Out-of-family parameter is flagged, not applied.
	await setMotion(false);
	await fill('input-scale', 5);
	await page.waitForTimeout(200);
	const bad = await state();
	rows.push(['scale=5 flagged outside Φ', bad.paramsValid === false, `paramsValid=${bad.paramsValid}`]);
	await page.screenshot({path: 'out/debugger/constraint-violation.png'});

	// Reset restores defaults.
	await fill('input-yaw', 1.1);
	await fill('input-frame', 321);
	await setMotion(true);
	await page.getByTestId('btn-reset').click();
	await page.waitForTimeout(200);
	const r = await state();
	const isDefault =
		r.frame === 0 && r.followMotion === false && r.paramsValid &&
		JSON.stringify(r.params) === JSON.stringify({yaw: 0, pitch: 0, roll: 0, scale: 1, twist: 0});
	rows.push(['reset restores defaults', isDefault, JSON.stringify({frame: r.frame, followMotion: r.followMotion, params: r.params})]);
	await page.screenshot({path: 'out/debugger/after-reset.png'});

	rows.push(['no console/page errors', errors.length === 0, errors.length ? errors.join(' | ') : '0 errors']);
	writeFileSync('out/debugger/debugger-check.json', JSON.stringify({rows, log}, null, 2));
	ok = report(rows);
	console.log('screenshots: out/debugger/*.png');
} catch (e) {
	console.error(e);
} finally {
	await browser.close();
	server.stop();
}
process.exit(ok ? 0 : 1);
