import {CanvasTexture, SRGBColorSpace} from 'three';

/** Deterministic radial-gradient sprite texture (white, alpha falloff). */
export const createGlowTexture = (size = 128, hardness = 0.25): CanvasTexture => {
	const c = document.createElement('canvas');
	c.width = size;
	c.height = size;
	const g = c.getContext('2d');
	if (!g) {
		throw new Error('2D canvas unavailable');
	}
	const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
	grad.addColorStop(0, 'rgba(255,255,255,1)');
	grad.addColorStop(hardness, 'rgba(255,255,255,0.55)');
	grad.addColorStop(0.6, 'rgba(255,255,255,0.12)');
	grad.addColorStop(1, 'rgba(255,255,255,0)');
	g.fillStyle = grad;
	g.fillRect(0, 0, size, size);
	const t = new CanvasTexture(c);
	t.colorSpace = SRGBColorSpace;
	return t;
};
