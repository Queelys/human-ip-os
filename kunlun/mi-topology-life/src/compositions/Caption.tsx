import React, {useEffect, useState} from 'react';
import {AbsoluteFill, cancelRender, continueRender, delayRender, staticFile} from 'remotion';
import {CAPTION_FONT_FAMILY, CAPTION_FONT_FILE, CAPTION_LAYOUT, CAPTION_TEXT} from '../film/caption';

/**
 * Loads the embedded caption font before any frame is captured. If the font
 * fails to load or does not cover every caption glyph, the render fails
 * instead of silently falling back to a system font.
 */
const useCaptionFont = (): boolean => {
	const [handle] = useState(() => delayRender('Loading caption font'));
	const [ready, setReady] = useState(false);
	useEffect(() => {
		const face = new FontFace(CAPTION_FONT_FAMILY, `url(${staticFile(CAPTION_FONT_FILE)})`);
		face
			.load()
			.then((loaded) => {
				document.fonts.add(loaded);
				if (!document.fonts.check(`${CAPTION_LAYOUT.fontSizePx}px ${CAPTION_FONT_FAMILY}`, CAPTION_TEXT)) {
					throw new Error('Caption font does not cover the caption text');
				}
				setReady(true);
				continueRender(handle);
			})
			.catch((err: unknown) => {
				// Abort the render: never fall back silently to a system font.
				cancelRender(err instanceof Error ? err : new Error(String(err)));
			});
	}, [handle]);
	return ready;
};

export const Caption: React.FC<{readonly opacity: number}> = ({opacity}) => {
	const ready = useCaptionFont();
	return (
		<AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', pointerEvents: 'none'}}>
			<div
				data-testid="mi-caption"
				style={{
					marginBottom: CAPTION_LAYOUT.bottomPx,
					maxWidth: CAPTION_LAYOUT.maxWidthPx,
					fontFamily: `${CAPTION_FONT_FAMILY}, serif`,
					fontSize: CAPTION_LAYOUT.fontSizePx,
					letterSpacing: `${CAPTION_LAYOUT.letterSpacingEm}em`,
					color: CAPTION_LAYOUT.color,
					textShadow: '0 0 18px rgba(120,190,255,0.45)',
					whiteSpace: 'nowrap',
					opacity: ready ? opacity : 0,
				}}
			>
				{CAPTION_TEXT}
			</div>
		</AbsoluteFill>
	);
};
