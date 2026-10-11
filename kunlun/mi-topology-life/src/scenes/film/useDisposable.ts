import {useEffect, useMemo} from 'react';

/**
 * useMemo for GPU resources: the previous value is disposed when deps change
 * and on unmount, so per-frame geometry does not leak over 900 frames.
 */
export const useDisposable = <T extends {dispose: () => void}>(factory: () => T, deps: readonly unknown[]): T => {
	// eslint-disable-next-line react-hooks/exhaustive-deps
	const value = useMemo(factory, deps);
	useEffect(() => () => value.dispose(), [value]);
	return value;
};
