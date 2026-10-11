/**
 * C004.1 sound identity mapping. Everything is *read* from the C002 identity
 * spec — anchor ids, pulse phase offsets, pulse period (identity pulse
 * frequency) and seed. Nothing here re-defines the pulse protocol: the pulse
 * envelope itself is always `pulseIntensity` from src/motion/pulse.ts.
 *
 * Derived (presentation) choices, documented in docs/C004_AUDIO_QC.md:
 *  - pitch ratios come from the knot winding numbers (p, q) = (2, 3):
 *    A1 : A2 : A3 = 1 : q/p : p  →  1 : 3/2 : 2
 *  - stereo pan comes from the anchor's curve parameter s: 0.7·sin(2πs)
 */
import type {AnchorId, MiIdentitySpec} from '../identity/miKernel';

/** Base pitch of the identity pulses (A1). Chosen above all other tracks' partials. */
export const PULSE_BASE_HZ = 660;

export type AnchorVoice = {
	readonly id: AnchorId;
	readonly s: number;
	/** Phase offset of this anchor's pulse, as read from spec.pulse.phaseOffsets. */
	readonly phaseOffset: number;
	readonly pitchHz: number;
	/** −1 (left) … +1 (right). */
	readonly pan: number;
};

export type AudioIdentity = {
	readonly seed: number;
	readonly version: string;
	readonly pulsePeriodSeconds: number;
	/** Identity pulse frequency = 1 / period. */
	readonly pulseRateHz: number;
	readonly pulseWidth: number;
	readonly ratios: readonly [number, number, number];
	readonly voices: readonly AnchorVoice[];
};

export const audioIdentityFromSpec = (spec: MiIdentitySpec): AudioIdentity => {
	const {p, q} = spec.knot;
	const ratios = [1, q / p, p] as const;
	return {
		seed: spec.seed,
		version: spec.version,
		pulsePeriodSeconds: spec.pulse.periodSeconds,
		pulseRateHz: 1 / spec.pulse.periodSeconds,
		pulseWidth: spec.pulse.width,
		ratios,
		voices: spec.anchors.map((a, i) => ({
			id: a.id,
			s: a.s,
			phaseOffset: spec.pulse.phaseOffsets[i],
			pitchHz: PULSE_BASE_HZ * ratios[i],
			pan: 0.7 * Math.sin(2 * Math.PI * a.s),
		})),
	};
};

/**
 * Times (s) in [0, duration) at which anchor `i`'s P pulse peaks, derived from
 * the spec: phase(t) = frac(t/T − o_i) = width/2.
 */
export const pulsePeakTimes = (spec: MiIdentitySpec, anchorIndex: number, durationSeconds: number): number[] => {
	const T = spec.pulse.periodSeconds;
	const o = spec.pulse.phaseOffsets[anchorIndex];
	const out: number[] = [];
	for (let k = -1; (k + o + spec.pulse.width / 2) * T < durationSeconds; k++) {
		const t = (k + o + spec.pulse.width / 2) * T;
		if (t >= 0) out.push(t);
	}
	return out;
};
