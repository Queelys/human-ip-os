/**
 * Fixed-seed reproducibility of the whole audio master: render again into
 * out/audio-rerun and compare SHA-256 of master WAV, AAC and every stem with
 * renders/audio. Report: out/logs/audio-determinism.json
 */
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {report} from './lib.mjs';

const A = 'renders/audio';
const B = 'out/audio-rerun';
const r = spawnSync('npx', ['vite-node', 'src/audio/cli.ts', '--', '--out', B, '--work', 'out/audio-rerun-work'], {encoding: 'utf8'});
if (r.status !== 0) throw new Error(r.stderr);
const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');
const files = ['mi-audio-master.wav', 'mi-audio-final.m4a', ...readdirSync(join(A, 'stems')).map((f) => join('stems', f))];
const results = files.map((f) => ({file: f, a: sha(join(A, f)), b: sha(join(B, f))}));
writeFileSync('out/logs/audio-determinism.json', JSON.stringify(results, null, 2));
process.exit(report(results.map((x) => [`reproducible: ${x.file}`, x.a === x.b, x.a.slice(0, 16)])) ? 0 : 1);
