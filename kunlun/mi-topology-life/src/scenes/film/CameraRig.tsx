/**
 * Applies the pure camera state to the R3F default camera. useLayoutEffect
 * runs before <ThreeCanvas>'s per-frame advance() (a passive effect), so the
 * frame is always rendered with this frame's camera.
 */
import {useThree} from '@react-three/fiber';
import {useLayoutEffect} from 'react';
import type {PerspectiveCamera} from 'three';
import type {CameraState} from '../../film/camera';

export const CameraRig: React.FC<{readonly camera: CameraState}> = ({camera}) => {
	const cam = useThree((s) => s.camera) as PerspectiveCamera;
	useLayoutEffect(() => {
		cam.position.set(...camera.position);
		cam.up.set(...camera.up);
		cam.fov = camera.fov;
		cam.near = 0.1;
		cam.far = 200;
		cam.lookAt(...camera.target);
		cam.updateProjectionMatrix();
		cam.updateMatrixWorld();
	}, [cam, camera]);
	return null;
};
