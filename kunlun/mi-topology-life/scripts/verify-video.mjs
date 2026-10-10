/**
 * Verify an encoded video with ffprobe.
 * Usage: node scripts/verify-video.mjs <file> --width W --height H --fps F --frames N --duration S
 */
import {parseArgs} from 'node:util';
import {report, run} from './lib.mjs';

const {positionals, values} = parseArgs({
	allowPositionals: true,
	options: {
		width: {type: 'string'},
		height: {type: 'string'},
		fps: {type: 'string'},
		frames: {type: 'string'},
		duration: {type: 'string'},
	},
});
const file = positionals[0];
const want = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v)]));

const probe = JSON.parse(
	run('ffprobe', [
		'-v', 'error',
		'-select_streams', 'v:0',
		'-count_frames',
		'-show_entries',
		'stream=codec_name,pix_fmt,width,height,r_frame_rate,avg_frame_rate,nb_frames,nb_read_frames,duration:format=duration',
		'-of', 'json',
		file,
	]).stdout,
);
const s = probe.streams[0];
const ratio = (r) => {
	const [n, d] = r.split('/').map(Number);
	return n / d;
};
const frameTime = 1 / want.fps;

console.log(`ffprobe ${file}`);
console.log(JSON.stringify(probe, null, 2));
const ok = report([
	['width', s.width === want.width, `${s.width} (want ${want.width})`],
	['height', s.height === want.height, `${s.height} (want ${want.height})`],
	['r_frame_rate', ratio(s.r_frame_rate) === want.fps, `${s.r_frame_rate} (want ${want.fps})`],
	['avg_frame_rate', ratio(s.avg_frame_rate) === want.fps, `${s.avg_frame_rate} (want ${want.fps})`],
	['nb_read_frames (decoded)', Number(s.nb_read_frames) === want.frames, `${s.nb_read_frames} (want ${want.frames})`],
	['nb_frames (container)', Number(s.nb_frames) === want.frames, `${s.nb_frames} (want ${want.frames})`],
	['stream duration', Math.abs(Number(s.duration) - want.duration) < frameTime / 2, `${s.duration}s (want ${want.duration}s)`],
	['format duration', Math.abs(Number(probe.format.duration) - want.duration) < frameTime / 2, `${probe.format.duration}s (want ${want.duration}s ± half frame)`],
	['codec', s.codec_name === 'h264', s.codec_name],
	['pix_fmt', s.pix_fmt === 'yuv420p', s.pix_fmt],
]);
process.exit(ok ? 0 : 1);
