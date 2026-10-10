/**
 * Run the full Vitest suite with a verbose text log and a JSON report:
 *   out/test-logs/vitest.txt, out/test-logs/vitest.json
 * Property-test reports land in out/test-logs/property/ (see tests/support/property.ts).
 */
import {spawnSync} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';

mkdirSync('out/test-logs', {recursive: true});
const res = spawnSync(
	'npx',
	['vitest', 'run', '--reporter=verbose', '--reporter=json', '--outputFile.json=out/test-logs/vitest.json'],
	{encoding: 'utf8', env: {...process.env, FORCE_COLOR: '0'}},
);
// Strip ANSI colour codes so the committed log is plain text.
// eslint-disable-next-line no-control-regex
const text = `${res.stdout}\n${res.stderr}`.replace(/\u001b\[[0-9;]*m/g, '');
writeFileSync('out/test-logs/vitest.txt', text);
process.stdout.write(text);
process.exit(res.status ?? 1);
