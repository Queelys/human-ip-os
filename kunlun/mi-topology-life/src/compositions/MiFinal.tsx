/**
 * C004 final picture: the unchanged C003 film (MiFilm) with its built-in
 * caption disabled, plus exactly one caption layer using the approved C004
 * timing (28.0 in → 28.5 full → 29.5 out → 30.0 end). Same text, font and
 * layout as C003; only the opacity curve differs. No double overlay.
 */
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {finalCaptionOpacity} from '../final/captionTiming';
import {Caption} from './Caption';
import {MiFilm} from './MiFilm';

export const MiFinal: React.FC = () => {
	const frame = useCurrentFrame();
	return (
		<AbsoluteFill>
			<MiFilm captionEnabled={false} />
			<Caption opacity={finalCaptionOpacity(frame)} />
		</AbsoluteFill>
	);
};
