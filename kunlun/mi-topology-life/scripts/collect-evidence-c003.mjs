/**
 * Copy C003 evidence (test logs, render logs, smoke-test report, integration
 * report, the acceptance run log) into docs/evidence/c003/.
 */
import {cpSync, existsSync, mkdirSync, readdirSync, rmSync} from 'node:fs';
import {join} from 'node:path';

const DEST = 'docs/evidence/c003';
rmSync(DEST, {recursive: true, force: true});
mkdirSync(join(DEST, 'render-logs'), {recursive: true});
const items = [
	['out/test-logs/vitest.txt', 'vitest.txt'],
	['out/test-logs/vitest.json', 'vitest.json'],
	['out/test-logs/camera-continuity.json', 'camera-continuity.json'],
	['out/test-logs/envelope-continuity.json', 'envelope-continuity.json'],
	['out/test-logs/film-geometry.json', 'film-geometry.json'],
	['out/test-logs/film-plan.json', 'film-plan.json'],
	['out/logs/integration.json', 'integration.json'],
	['out/logs/integration-studio-mi-film.png', 'integration-studio-mi-film.png'],
	['out/logs/verify-film.json', 'verify-film.json'],
];
for (const [from, to] of items) {
	if (!existsSync(from)) {
		console.error(`missing ${from}`);
		process.exit(1);
	}
	cpSync(from, join(DEST, to));
	console.log(`${from} → ${DEST}/${to}`);
}
for (const f of readdirSync('out/logs').filter((n) => /^(render-|stills-).*\.(json|txt)$/.test(n))) {
	cpSync(join('out/logs', f), join(DEST, 'render-logs', f));
}
if (existsSync('out/acceptance-c003.log')) cpSync('out/acceptance-c003.log', join(DEST, 'acceptance-c003.log'));
console.log('render logs copied');
