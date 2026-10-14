/**
 * C005 TASK 02 — nine review keyframes decoded from the actual final master
 * (not re-rendered), plus a labelled review sheet.
 * Output: docs/review/c005/keyframes/*.jpg, docs/review/c005/review-sheet.jpg
 */
import {existsSync, mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {run} from './lib.mjs';

const MASTER = 'renders/masters/mi-final-1080p.mp4';
const OUT = 'docs/review/c005/keyframes';
export const KEYFRAMES = [
	{k: 'K1', frame: 101, act: 'I 未分', note: '第一次微弱脉动（A1）'},
	{k: 'K2', frame: 240, act: 'II 破缺', note: '三锚点显现，不对称轨迹生长'},
	{k: 'K3', frame: 329, act: 'II 破缺', note: '推进完成（幕末）'},
	{k: 'K4', frame: 420, act: 'III 织生', note: '外围神经网络生成'},
	{k: 'K5', frame: 539, act: 'III 织生', note: '环绕完成，信息传播（幕末）'},
	{k: 'K6', frame: 650, act: 'IV 易形', note: '形变峰值，主结逐渐完整'},
	{k: 'K7', frame: 749, act: 'IV 易形', note: '拉远完成（幕末）'},
	{k: 'K8', frame: 855, act: 'V 自见', note: '回到正面，字幕完全可见（28.5 s）'},
	{k: 'K9', frame: 899, act: 'V 自见', note: '最后一帧（字幕淡出至 0.003）'},
];
mkdirSync(OUT, {recursive: true});
for (const kf of KEYFRAMES) {
	const file = join(OUT, `${kf.k}-f${String(kf.frame).padStart(3, '0')}.jpg`);
	run('ffmpeg', ['-v', 'error', '-y', '-i', MASTER, '-vf', `select=eq(n\\,${kf.frame})`, '-frames:v', '1', '-q:v', '2', file]);
	kf.file = file;
}
const FONT = '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc';
if (!existsSync(FONT)) throw new Error('label font missing');
const inputs = KEYFRAMES.flatMap((kf) => ['-i', kf.file]);
const filters = KEYFRAMES.map(
	(kf, i) =>
		`[${i}]scale=640:360,drawbox=x=0:y=0:w=iw:h=32:color=black@0.6:t=fill,drawtext=fontfile=${FONT}:text='${kf.k} · F${String(kf.frame).padStart(3, '0')} · ${(kf.frame / 30).toFixed(2)}s · ACT ${kf.act}':x=10:y=7:fontsize=17:fontcolor=0xdfe8ff[v${i}]`,
);
filters.push(`${KEYFRAMES.map((_, i) => `[v${i}]`).join('')}xstack=inputs=9:layout=0_0|640_0|1280_0|0_360|640_360|1280_360|0_720|640_720|1280_720[out]`);
run('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', filters.join(';'), '-map', '[out]', '-frames:v', '1', '-q:v', '2', 'docs/review/c005/review-sheet.jpg']);
console.log(JSON.stringify(KEYFRAMES.map(({k, frame, file}) => ({k, frame, file}))));
