import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

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
