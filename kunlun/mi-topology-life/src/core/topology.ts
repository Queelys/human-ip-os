/**
 * Topology checks on indexed triangle meshes. Used by tests to prove that
 * presentation geometry still satisfies the identity kernel's invariants.
 */

export type IndexedMesh = {
	/** Flat xyz positions. */
	readonly positions: ArrayLike<number>;
	/** Flat triangle indices. */
	readonly indices: ArrayLike<number>;
};

/**
 * Euler characteristic V − E + F after welding vertices that share a position
 * (within `epsilon`), so UV seams do not count as boundaries.
 */
export const eulerCharacteristic = (mesh: IndexedMesh, epsilon = 1e-5): number => {
	const key = (i: number) =>
		[0, 1, 2]
			.map((k) => Math.round(mesh.positions[i * 3 + k] / epsilon))
			.join(',');

	const weld = new Map<string, number>();
	const remap: number[] = [];
	const vertexCount = mesh.positions.length / 3;
	for (let i = 0; i < vertexCount; i++) {
		const k = key(i);
		let id = weld.get(k);
		if (id === undefined) {
			id = weld.size;
			weld.set(k, id);
		}
		remap.push(id);
	}

	const edges = new Set<string>();
	let faces = 0;
	for (let t = 0; t < mesh.indices.length; t += 3) {
		const a = remap[mesh.indices[t]];
		const b = remap[mesh.indices[t + 1]];
		const c = remap[mesh.indices[t + 2]];
		if (a === b || b === c || a === c) {
			continue; // degenerate after welding
		}
		faces++;
		for (const [u, v] of [
			[a, b],
			[b, c],
			[c, a],
		]) {
			edges.add(u < v ? `${u}-${v}` : `${v}-${u}`);
		}
	}

	const usedVertices = new Set(remap).size;
	return usedVertices - edges.size + faces;
};
