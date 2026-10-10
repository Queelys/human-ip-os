/**
 * Vite config for the C002 identity debugger page (not the Remotion Studio).
 * Vite is already in the tree as a Vitest dependency; it is pinned as a
 * direct devDependency so this config does not rely on a transitive version.
 */
import {defineConfig} from 'vite';

export default defineConfig({
	root: 'debugger',
	base: './',
	server: {port: 3200, strictPort: true, fs: {allow: ['..']}},
	preview: {port: 3201, strictPort: true},
	build: {outDir: '../build-debugger', emptyOutDir: true, chunkSizeWarningLimit: 2000},
	esbuild: {jsx: 'automatic'},
});
