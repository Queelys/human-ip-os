/** Minimal RIFF/WAVE writer: 24-bit PCM or 32-bit float, interleaved stereo. */
import type {Stereo} from './tracks';
import {SAMPLE_RATE} from './constants';

export const encodeWav = (s: Stereo, format: 'pcm24' | 'float32'): Buffer => {
	const N = s.L.length;
	const bytes = format === 'pcm24' ? 3 : 4;
	const dataSize = N * 2 * bytes;
	const b = Buffer.alloc(44 + dataSize);
	b.write('RIFF', 0, 'latin1');
	b.writeUInt32LE(36 + dataSize, 4);
	b.write('WAVE', 8, 'latin1');
	b.write('fmt ', 12, 'latin1');
	b.writeUInt32LE(16, 16);
	b.writeUInt16LE(format === 'pcm24' ? 1 : 3, 20);
	b.writeUInt16LE(2, 22);
	b.writeUInt32LE(SAMPLE_RATE, 24);
	b.writeUInt32LE(SAMPLE_RATE * 2 * bytes, 28);
	b.writeUInt16LE(2 * bytes, 32);
	b.writeUInt16LE(bytes * 8, 34);
	b.write('data', 36, 'latin1');
	b.writeUInt32LE(dataSize, 40);
	let o = 44;
	for (let n = 0; n < N; n++) {
		for (const v of [s.L[n], s.R[n]]) {
			if (!Number.isFinite(v)) throw new Error(`non-finite sample at ${n}`);
			if (format === 'float32') {
				b.writeFloatLE(v, o);
			} else {
				// Deterministic rounding, hard-clamped to the 24-bit range (no dither).
				const i = Math.max(-8388608, Math.min(8388607, Math.round(v * 8388607)));
				b.writeIntLE(i, o, 3);
			}
			o += bytes;
		}
	}
	return b;
};
