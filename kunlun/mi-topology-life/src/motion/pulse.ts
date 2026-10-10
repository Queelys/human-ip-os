/**
 * P — pulse protocol. Each anchor pulses with the same waveform and period,
 * shifted by a fixed phase offset. Intensity is a closed-form function of
 * global time: no accumulated state, any frame can be evaluated alone.
 */
import type {AnchorId, MiIdentitySpec} from '../identity/miKernel';

const TAU = Math.PI * 2;

const anchorIndex = (spec: MiIdentitySpec, id: AnchorId): number => {
	const i = spec.anchors.findIndex((a) => a.id === id);
	if (i < 0) {
		throw new Error(`Unknown anchor ${id}`);
	}
	return i;
};

/** Pulse phase of an anchor at time t, in [0, 1). */
export const pulsePhase = (spec: MiIdentitySpec, id: AnchorId, timeSeconds: number): number => {
	const x = timeSeconds / spec.pulse.periodSeconds - spec.pulse.phaseOffsets[anchorIndex(spec, id)];
	return x - Math.floor(x);
};

/** Raised-cosine bump: 0 outside [0, width), peaks at 1 at width/2. */
export const pulseWaveform = (phase: number, width: number): number =>
	phase < width ? 0.5 * (1 - Math.cos((TAU * phase) / width)) : 0;

/** Pulse intensity ∈ [0, 1] of an anchor at time t. */
export const pulseIntensity = (spec: MiIdentitySpec, id: AnchorId, timeSeconds: number): number =>
	pulseWaveform(pulsePhase(spec, id, timeSeconds), spec.pulse.width);

export const pulseIntensities = (spec: MiIdentitySpec, timeSeconds: number): Record<AnchorId, number> => ({
	A1: pulseIntensity(spec, 'A1', timeSeconds),
	A2: pulseIntensity(spec, 'A2', timeSeconds),
	A3: pulseIntensity(spec, 'A3', timeSeconds),
});
