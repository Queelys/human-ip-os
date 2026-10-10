import {describe, expect, it} from 'vitest';
import {createCoreGeometry, createSatelliteField} from '../src/core/geometry';
import {assertKernelConsistent, MI_IDENTITY} from '../src/core/identity';
import {eulerCharacteristic} from '../src/core/topology';

describe('Mi identity kernel', () => {
	it('is frozen and internally consistent', () => {
		expect(Object.isFrozen(MI_IDENTITY)).toBe(true);
		expect(Object.isFrozen(MI_IDENTITY.invariants)).toBe(true);
		expect(() => assertKernelConsistent(MI_IDENTITY)).not.toThrow();
	});

	it('rejects an inconsistent kernel', () => {
		expect(() =>
			assertKernelConsistent({
				...MI_IDENTITY,
				invariants: {...MI_IDENTITY.invariants, eulerCharacteristic: 2},
			}),
		).toThrow();
	});

	it('core geometry preserves the declared Euler characteristic', () => {
		const geo = createCoreGeometry(MI_IDENTITY);
		const chi = eulerCharacteristic({
			positions: geo.getAttribute('position').array,
			indices: geo.getIndex()!.array,
		});
		expect(chi).toBe(MI_IDENTITY.invariants.eulerCharacteristic);
	});

	it('satellite field is reproducible from the seed', () => {
		const a = createSatelliteField(MI_IDENTITY, 500);
		const b = createSatelliteField(MI_IDENTITY, 500);
		expect(Array.from(a)).toEqual(Array.from(b));
	});
});
