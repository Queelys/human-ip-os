/**
 * C005 TASK 04 — KUNLUN-MI-FILM-001 asset record (machine-readable).
 * Every archived file: category, SHA-256, size, how it was produced, and the
 * git commit that last changed it. Release materials are listed as BLOCKED
 * until they exist. Output: docs/archive/KUNLUN-MI-FILM-001.manifest.json
 */
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');
const git = (...a) => execFileSync('git', a, {encoding: 'utf8'}).trim();
const walk = (dir) =>
	readdirSync(dir, {withFileTypes: true}).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)])).sort();

const CATEGORIES = [
	{id: 'character', zh: '角色设定', files: ['FILM_BIBLE.md', 'docs/MI_IDENTITY_SPEC.md', ...walk('src/identity')], source: 'C001–C002 人工编写；身份内核代码'},
	{id: 'math', zh: '数学规则', files: ['docs/MI_MATH_RULES.md', 'src/geometry/trefoil.ts', 'src/motion/deformation.ts', 'src/motion/pulse.ts'], source: 'C002'},
	{id: 'code', zh: '代码版本', files: ['package.json', 'package-lock.json', 'remotion.config.ts', 'tsconfig.json', ...walk('src'), ...walk('scripts')], source: 'git 仓库（见 code.gitHead / code.srcTree）'},
	{id: 'storyboard', zh: '分镜', files: ['SHOT_LIST.md', 'docs/C003_SHOT_LIST.md', 'docs/C003_CAMERA_SPEC.md', 'docs/C003_VISUAL_SPEC.md', 'renders/mi-storyboard-contact-sheet.png', ...walk('docs/review/c005')], source: 'C003 渲染联系表；C005 从最终母版解码的审片关键帧'},
	{id: 'audio', zh: '音频素材', files: ['renders/audio/mi-audio-master.wav', 'renders/audio/mi-audio-final.m4a', ...walk('renders/audio/stems')], source: 'C004 `npm run audio:master`（程序化合成，无外部素材）'},
	{id: 'video', zh: '最终视频', files: ['renders/masters/mi-final-1080p.mp4', 'renders/mi-visual-master-1080p.mp4', 'renders/mi-preview-540p.mp4'], source: 'C003 `render:film:*`；C004 `render:final:picture` + `final:mux`'},
	{id: 'release', zh: '发行物料', files: existsSync('renders/release') ? walk('renders/release') : [], source: existsSync('renders/release') ? 'C005 发行素材' : 'BLOCKED：等待 C004 人工最终验收与导演审片批准'},
	{id: 'licence', zh: '授权信息', files: ['public/fonts/OFL.txt', 'public/fonts/NotoSerifSC-Medium-caption.ttf', 'node_modules/remotion/LICENSE.md'], source: '第三方授权文本（见 C005_IP_ASSET_RECORD.md §授权）'},
	{id: 'records', zh: '创作与修改记录', files: ['README.md', 'ACCEPTANCE.md', 'docs/DECISIONS.md', 'docs/C002_ACCEPTANCE.md', 'docs/C003_ACCEPTANCE.md', 'docs/C004_ACCEPTANCE.md', 'docs/C004_RENDER_REPORT.md', 'docs/C004_AUDIO_QC.md', ...['C005_TECHNICAL_QC', 'C005_DIRECTOR_REVIEW', 'C005_RELEASE_PLAN', 'C005_IP_ASSET_RECORD', 'C005_FINAL_ACCEPTANCE'].map((n) => `docs/${n}.md`).filter(existsSync), ...walk('docs/evidence')], source: '各卡验收与证据'},
];

const lastCommit = (f) => {
	try {
		return git('log', '-1', '--format=%h %cs', '--', f) || 'uncommitted';
	} catch {
		return 'n/a';
	}
};
const record = {
	id: 'KUNLUN-MI-FILM-001',
	title: '弥：拓扑生命 / Mi: Topological Life',
	series: '昆仑协议 Kunlun Protocol · 实验短片',
	spec: {durationSeconds: 30, frames: 900, fps: 30, resolution: '1920x1080', audio: '48 kHz stereo'},
	identity: {kernel: 'MI Identity Kernel', version: '1.0.0', fingerprint: 'cd2e236379d37be5', seed: '0x4B4C4D49'},
	code: {gitHead: git('rev-parse', 'HEAD'), branch: git('rev-parse', '--abbrev-ref', 'HEAD'), srcTree: git('rev-parse', 'HEAD:kunlun/mi-topology-life/src')},
	status: {
		technicalQc: 'PASS (C005)',
		c004HumanFinalAcceptance: 'PENDING',
		directorReview: 'PENDING',
		release: 'BLOCKED — not approved for publication',
	},
	categories: CATEGORIES.map((c) => ({
		id: c.id,
		zh: c.zh,
		source: c.source,
		files: c.files.filter(existsSync).map((f) => ({path: f, bytes: statSync(f).size, sha256: sha(f), lastCommit: lastCommit(f)})),
	})),
};
mkdirSync('docs/archive', {recursive: true});
writeFileSync('docs/archive/KUNLUN-MI-FILM-001.manifest.json', JSON.stringify(record, null, 2));
for (const c of record.categories) console.log(`${c.zh.padEnd(8)} ${String(c.files.length).padStart(4)} files  ${(c.files.reduce((s, f) => s + f.bytes, 0) / 1e6).toFixed(1)} MB`);
