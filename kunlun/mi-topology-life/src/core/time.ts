/**
 * Deterministic time. The frame number is the only clock: wall time,
 * requestAnimationFrame deltas and THREE.Clock are never used for animation.
 */

export const frameToSeconds = (frame: number, fps: number): number => frame / fps;

/**
 * Phase in [0, 1) of a loop of `periodSeconds` at the given frame.
 * Computed from the integer frame, not accumulated, so there is no drift.
 */
export const loopPhase = (
	frame: number,
	fps: number,
	periodSeconds: number,
): number => {
	const periodFrames = fps * periodSeconds;
	const f = ((frame % periodFrames) + periodFrames) % periodFrames;
	return f / periodFrames;
};
