/**
 * C003.3 visual constants shared by the renderer and the tests.
 * Colour rationale and layer order: docs/C003_VISUAL_SPEC.md.
 */

/** Core tube radius (world units). Must stay ≤ 0.3 × strand separation (C002 MI_MATH_RULES §9). */
export const CORE_TUBE_RADIUS = 0.035;
/** Additive glow shells (visual halo only, not a surface). */
export const GLOW_SHELL_RADII = [0.085, 0.17] as const;
export const TUBE_RADIUS_TO_SEPARATION_MAX = 0.3;
