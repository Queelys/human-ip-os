import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {createServer} from 'node:http';
import {extname, join, normalize} from 'node:path';

export const COMPOSITION = 'C001-RenderTest';
export const ENTRY = 'src/index.ts';

export const run = (cmd, args, opts = {}) => {
	const res = spawnSync(cmd, args, {encoding: 'utf8', maxBuffer: 1 << 30, ...opts});
	if (res.status !== 0) {
		throw new Error(`${cmd} ${args.join(' ')} failed (${res.status}):\n${res.stderr}`);
	}
	return res;
};

/** SHA-256 of decoded RGBA pixels (ignores container/metadata bytes). */
export const pixelHash = (file) => {
	const res = spawnSync(
		'ffmpeg',
		['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'],
		{maxBuffer: 1 << 30},
	);
	if (res.status !== 0) {
		throw new Error(`ffmpeg decode failed for ${file}: ${res.stderr}`);
	}
	return createHash('sha256').update(res.stdout).digest('hex');
};

export const report = (rows) => {
	let ok = true;
	for (const [name, pass, detail] of rows) {
		ok &&= pass;
		console.log(`${pass ? 'PASS' : 'FAIL'}  ${name.padEnd(34)} ${detail}`);
	}
	return ok;
};

const MIME = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript',
	'.json': 'application/json',
	'.css': 'text/css',
	'.map': 'application/json',
};

/** Minimal static file server with SPA fallback to index.html. */
export const serveStatic = (dir, port) =>
	new Promise((resolve, reject) => {
		if (!existsSync(join(dir, 'index.html'))) {
			reject(new Error(`${dir}/index.html missing`));
			return;
		}
		const server = createServer((req, res) => {
			const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
			let file = join(dir, path);
			if (!existsSync(file) || statSync(file).isDirectory()) file = join(dir, 'index.html');
			res.writeHead(200, {'content-type': MIME[extname(file)] ?? 'application/octet-stream'});
			res.end(readFileSync(file));
		});
		server.listen(port, () => resolve({stop: () => server.close()}));
	});

/** Decode an image to raw RGBA via ffmpeg. */
export const decodeRgba = (file) => {
	const probe = JSON.parse(
		run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', file]).stdout,
	);
	const {width, height} = probe.streams[0];
	const res = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], {maxBuffer: 1 << 30});
	if (res.status !== 0) throw new Error(`decode failed: ${file}`);
	return {width, height, data: res.stdout};
};

/** Rec. 709 luma of an RGBA pixel buffer, averaged (0–255). */
export const meanLuma = ({data}) => {
	let s = 0;
	for (let i = 0; i < data.length; i += 4) s += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
	return s / (data.length / 4);
};

/** Mean absolute per-channel difference (0–255) between two equal-size images. */
export const meanAbsDiff = (a, b) => {
	let s = 0;
	for (let i = 0; i < a.data.length; i += 4) {
		s += Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]);
	}
	return s / ((a.data.length / 4) * 3);
};
