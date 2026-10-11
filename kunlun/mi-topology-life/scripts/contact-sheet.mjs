/**
 * Storyboard contact sheet: one row per act (first · representative · last),
 * built with ffmpeg from the stills rendered by verify-film.mjs.
 * Output: renders/mi-storyboard-contact-sheet.png
 */
import {existsSync, mkdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {run} from './lib.mjs';

const plan = JSON.parse(readFileSync('out/test-logs/film-plan.json', 'utf8'));
const STILLS = 'out/film/stills';
const OUT = 'renders/mi-storyboard-contact-sheet.png';
const FONT = ['/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'].find(existsSync);
if (!FONT) throw new Error('No CJK font found for contact-sheet labels');
const W = 640;
const H = 360;

const inputs = [];
const filters = [];
let n = 0;
for (const act of plan.acts) {
	for (const [kind, f] of [['首帧 first', act.start], ['代表 rep', act.representative], ['末帧 last', act.end]]) {
		const src = join(STILLS, `f${String(f).padStart(3, '0')}.png`);
		if (!existsSync(src)) throw new Error(`missing still ${src} — run npm run verify:film first`);
		inputs.push('-i', src);
		const label = `ACT ${act.id} ${act.name} · ${kind} · F${String(f).padStart(3, '0')} · ${(f / plan.film.fps).toFixed(2)}s`;
		filters.push(
			`[${n}]scale=${W}:${H},drawbox=x=0:y=0:w=iw:h=34:color=black@0.6:t=fill,` +
				`drawtext=fontfile=${FONT}:text='${label}':x=12:y=8:fontsize=18:fontcolor=0xdfe8ff[v${n}]`,
		);
		n++;
	}
}
const layout = Array.from({length: n}, (_, i) => `${(i % 3) * W}_${Math.floor(i / 3) * H}`).join('|');
filters.push(`${Array.from({length: n}, (_, i) => `[v${i}]`).join('')}xstack=inputs=${n}:layout=${layout}[out]`);
mkdirSync('renders', {recursive: true});
run('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', filters.join(';'), '-map', '[out]', '-frames:v', '1', OUT]);
console.log(`${OUT} (${n} frames, ${3 * W}×${(n / 3) * H})`);
