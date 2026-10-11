/**
 * C004.4 / C004.6 offline audio render + master (Node only; run with vite-node).
 *
 *   npx vite-node src/audio/cli.ts -- --out renders/audio [--target -16] [--tp -1] [--work out/audio]
 *
 * 1. Render the five stems (deterministic), DC-block + edge-fade each.
 * 2. Pre-mix; measure loudness with ffmpeg ebur128 (true peak on).
 * 3. Gain to the target, look-ahead limiter at a ceiling; re-measure and
 *    correct gain once; if WAV or AAC true peak > limit, lower the ceiling.
 * 4. Write stems (24-bit, same gain as the mix, pre-limiter), master WAV
 *    (24-bit), AAC (256 kb/s), and out/audio/audio-report.json.
 */
import {execFileSync, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {parseArgs} from 'node:util';
import {FILM_SPEC} from '../film/choreography';
import {CHANNELS, SAMPLE_RATE, TOTAL_SAMPLES} from './constants';
import {buildControlTable} from './control';
import {audioIdentityFromSpec} from './identity';
import {conditionStem, dbToGain, limit, scaleStereo, stats, sumStereo} from './mix';
import {renderBody, renderFinale, renderGrains, renderPulse, renderResonance, type Stereo, TRACKS} from './tracks';
import {encodeWav} from './wav';

const {values} = parseArgs({
	options: {
		out: {type: 'string', default: 'renders/audio'},
		target: {type: 'string', default: '-16'},
		tp: {type: 'string', default: '-1'},
		work: {type: 'string', default: 'out/audio'},
	},
});
const OUT = values.out;
const TARGET_LUFS = Number(values.target);
const TP_LIMIT = Number(values.tp);
const TMP = values.work;
mkdirSync(join(OUT, 'stems'), {recursive: true});
mkdirSync(TMP, {recursive: true});

type Loudness = {integratedLufs: number; truePeakDbtp: number; lraLu: number};

/** ffmpeg EBU R128 measurement (BS.1770, true peak via 4× oversampling). */
const measure = (file: string): Loudness => {
	const res = spawnSync('ffmpeg', ['-nostats', '-hide_banner', '-i', file, '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-'], {encoding: 'utf8'});
	if (res.status !== 0) throw new Error(`ebur128 failed: ${res.stderr}`);
	const summary = res.stderr.slice(res.stderr.lastIndexOf('Summary:'));
	const num = (re: RegExp) => {
		const m = summary.match(re);
		if (!m) throw new Error(`cannot parse ${re} from:\n${summary}`);
		return Number(m[1]);
	};
	return {
		integratedLufs: num(/I:\s+(-?[\d.]+) LUFS/),
		lraLu: num(/LRA:\s+(-?[\d.]+) LU/),
		truePeakDbtp: num(/True peak:\s+Peak:\s+(-?[\d.]+|-inf) dBFS/),
	};
};

const sha256 = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
const encodeAac = (wav: string, m4a: string) =>
	execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', wav, '-c:a', 'aac', '-b:a', '256k', '-ar', String(SAMPLE_RATE), '-ac', String(CHANNELS), m4a]);

// 1. Stems.
const spec = FILM_SPEC;
const ctlT = buildControlTable();
const raw: Record<string, Stereo> = {
	body: renderBody(ctlT),
	pulse: renderPulse(spec, ctlT),
	grains: renderGrains(spec, ctlT),
	resonance: renderResonance(spec, ctlT),
	finale: renderFinale(spec, ctlT),
};
const stems = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, conditionStem(v)])) as Record<string, Stereo>;
const premix = sumStereo(Object.values(stems));
const premixStats = stats(premix);
if (premixStats.nonFinite > 0) throw new Error(`pre-mix has ${premixStats.nonFinite} non-finite samples`);
writeFileSync(join(TMP, 'premix.wav'), encodeWav(premix, 'float32'));
const premixLoudness = measure(join(TMP, 'premix.wav'));

// 2–3. Gain + limiter, iterate ceiling until WAV and AAC true peak meet the limit.
const attempts: unknown[] = [];
let final: {gainDb: number; ceilingDb: number; mix: Stereo; wav: Loudness; aac: Loudness; maxReductionDb: number} | null = null;
for (const ceilingDb of [-2.0, -2.5, -3.0, -3.5, -4.0]) {
	let gainDb = TARGET_LUFS - premixLoudness.integratedLufs;
	let lim = limit(scaleStereo(premix, dbToGain(gainDb)), ceilingDb);
	writeFileSync(join(TMP, 'pass.wav'), encodeWav(lim.out, 'float32'));
	const first = measure(join(TMP, 'pass.wav'));
	// One correction for loudness lost in the limiter.
	gainDb += TARGET_LUFS - first.integratedLufs;
	lim = limit(scaleStereo(premix, dbToGain(gainDb)), ceilingDb);
	writeFileSync(join(TMP, 'pass.wav'), encodeWav(lim.out, 'pcm24'));
	const wav = measure(join(TMP, 'pass.wav'));
	encodeAac(join(TMP, 'pass.wav'), join(TMP, 'pass.m4a'));
	const aac = measure(join(TMP, 'pass.m4a'));
	attempts.push({ceilingDb, gainDb, wav, aac, maxReductionDb: lim.maxReductionDb});
	if (wav.truePeakDbtp <= TP_LIMIT && aac.truePeakDbtp <= TP_LIMIT) {
		final = {gainDb, ceilingDb, mix: lim.out, wav, aac, maxReductionDb: lim.maxReductionDb};
		break;
	}
}
if (!final) throw new Error(`could not meet true peak ≤ ${TP_LIMIT} dBTP: ${JSON.stringify(attempts)}`);

// 4. Write deliverables.
const g = dbToGain(final.gainDb);
const stemFiles: Record<string, unknown> = {};
for (const t of TRACKS) {
	const s = scaleStereo(stems[t.id], g);
	const file = join(OUT, 'stems', `${String(t.index).padStart(2, '0')}-${t.id}.wav`);
	writeFileSync(file, encodeWav(s, 'pcm24'));
	stemFiles[t.id] = {file, nameZh: t.nameZh, stats: stats(s), loudness: measure(file), sha256: sha256(file)};
}
const masterWav = join(OUT, 'mi-audio-master.wav');
const masterAac = join(OUT, 'mi-audio-final.m4a');
writeFileSync(masterWav, encodeWav(final.mix, 'pcm24'));
encodeAac(masterWav, masterAac);

const report = {
	sampleRate: SAMPLE_RATE,
	channels: CHANNELS,
	samples: TOTAL_SAMPLES,
	durationSeconds: TOTAL_SAMPLES / SAMPLE_RATE,
	targetLufs: TARGET_LUFS,
	truePeakLimitDbtp: TP_LIMIT,
	identity: audioIdentityFromSpec(spec),
	premix: {stats: premixStats, loudness: premixLoudness},
	attempts,
	master: {
		gainDb: final.gainDb,
		limiterCeilingDb: final.ceilingDb,
		limiterMaxReductionDb: final.maxReductionDb,
		stats: stats(final.mix),
		wav: {file: masterWav, loudness: measure(masterWav), sha256: sha256(masterWav)},
		aac: {file: masterAac, loudness: measure(masterAac), sha256: sha256(masterAac), bitrate: '256k'},
	},
	stems: stemFiles,
};
writeFileSync(join(TMP, 'audio-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({gainDb: final.gainDb, ceilingDb: final.ceilingDb, wav: report.master.wav.loudness, aac: report.master.aac.loudness}, null, 2));
