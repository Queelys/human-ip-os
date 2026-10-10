/**
 * Browser preview check (Playwright + headless Chromium).
 *
 * Targets:
 *   build  — the static bundle from `npm run build` (read-only Studio), served
 *            locally. No outbound network calls; any console error fails.
 *   studio — live `remotion studio`. The Studio shell fetches Remotion's
 *            known-bugs endpoint; in network-restricted sandboxes that request
 *            is blocked. Only that exact URL is tolerated and it is reported
 *            as ENV-ALLOWED, never silently dropped.
 *
 * Usage: node scripts/verify-preview.mjs [build|studio|all]   (default: all)
 * Saves screenshots to out/preview-<target>.png.
 */
import {spawn} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, statSync} from 'node:fs';
import {createServer} from 'node:http';
import {extname, join, normalize} from 'node:path';
import {chromium} from 'playwright';
import {COMPOSITION, ENTRY, report} from './lib.mjs';

const ENV_ALLOWED_FAILED_URLS = [/^https:\/\/bugs\.remotion\.dev\/api\//];
const target = process.argv[2] ?? 'all';
mkdirSync('out', {recursive: true});

const MIME = {'.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.map': 'application/json'};

const serveBuild = (port) =>
	new Promise((resolve, reject) => {
		if (!existsSync('build/index.html')) {
			reject(new Error('build/ missing — run `npm run build` first'));
			return;
		}
		const server = createServer((req, res) => {
			const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
			let file = join('build', path);
			// SPA fallback: composition routes resolve to index.html.
			if (!existsSync(file) || statSync(file).isDirectory()) file = 'build/index.html';
			res.writeHead(200, {'content-type': MIME[extname(file)] ?? 'application/octet-stream'});
			res.end(readFileSync(file));
		});
		server.listen(port, () => resolve({stop: () => server.close()}));
	});

const startStudio = async (port) => {
	const proc = spawn('npx', ['remotion', 'studio', ENTRY, `--port=${port}`, '--no-open'], {
		stdio: 'ignore',
		detached: true,
	});
	const deadline = Date.now() + 120_000;
	while (Date.now() < deadline) {
		try {
			if ((await fetch(`http://localhost:${port}/`)).ok) break;
		} catch {
			// not up yet
		}
		await new Promise((r) => setTimeout(r, 500));
	}
	return {
		stop: () => {
			try {
				process.kill(-proc.pid, 'SIGTERM');
			} catch {
				// already exited
			}
		},
	};
};

const checkPage = async (browser, name, url) => {
	const page = await browser.newPage({viewport: {width: 1600, height: 1000}});
	const errors = [];
	const envAllowed = [];
	const failedUrls = new Set();
	page.on('requestfailed', (r) => failedUrls.add(r.url()));
	page.on('console', (msg) => {
		if (msg.type() === 'error') errors.push({text: msg.text(), url: msg.location().url});
	});
	page.on('pageerror', (err) => errors.push({text: `pageerror: ${err.message}`, url: ''}));

	await page.goto(url, {waitUntil: 'networkidle'});
	await page.waitForSelector('canvas', {timeout: 60_000});
	await page.waitForTimeout(3000); // let the player run a few frames

	const canvas = await page.evaluate(() => {
		const c = globalThis.document.querySelector('canvas');
		const gl = c?.getContext('webgl2') ?? c?.getContext('webgl');
		return {width: c?.width ?? 0, height: c?.height ?? 0, webgl: Boolean(gl)};
	});
	await page.screenshot({path: `out/preview-${name}.png`});
	await page.close();

	const blocking = errors.filter((e) => {
		const allowed = failedUrls.has(e.url) && ENV_ALLOWED_FAILED_URLS.some((re) => re.test(e.url));
		if (allowed) envAllowed.push(e.url);
		return !allowed;
	});
	for (const u of envAllowed) console.log(`ENV-ALLOWED [${name}] blocked outbound request: ${u}`);
	return [
		[`[${name}] page loads`, true, url],
		[`[${name}] WebGL canvas mounted`, canvas.webgl && canvas.width > 0, `${canvas.width}×${canvas.height}`],
		[
			`[${name}] no console/page errors`,
			blocking.length === 0,
			blocking.length ? blocking.map((e) => `${e.text} ${e.url}`).join(' | ') : `0 errors (${envAllowed.length} env-allowed)`,
		],
	];
};

let ok = false;
const cleanups = [];
let browser;
try {
	browser = await chromium.launch({
		executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
		args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
	});
	const rows = [];
	if (target === 'build' || target === 'all') {
		const s = await serveBuild(3125);
		cleanups.push(s.stop);
		rows.push(...(await checkPage(browser, 'build', `http://localhost:3125/${COMPOSITION}`)));
	}
	if (target === 'studio' || target === 'all') {
		const s = await startStudio(3123);
		cleanups.push(s.stop);
		rows.push(...(await checkPage(browser, 'studio', `http://localhost:3123/${COMPOSITION}`)));
	}
	ok = report(rows);
} catch (err) {
	console.error(err);
} finally {
	await browser?.close();
	cleanups.forEach((c) => c());
}
process.exit(ok ? 0 : 1);
