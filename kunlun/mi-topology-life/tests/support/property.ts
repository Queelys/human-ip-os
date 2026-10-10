/**
 * Minimal, dependency-free property-test harness.
 *
 * - Each case gets its own seed derived from (baseSeed, property name, index),
 *   so a case can be reproduced in isolation.
 * - Every run writes a JSON report to out/test-logs/property/<name>.json with
 *   the base seed, case count and every failing (caseSeed, input, error).
 * - Reproduce one case:   MI_PROPERTY_SEED=<caseSeed> npx vitest run tests/property.test.ts
 * - Explore other seeds:  MI_PROPERTY_BASE_SEED=<uint32> npx vitest run tests/property.test.ts
 */
import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {deriveSeed, mulberry32} from '../../src/core/rng';

export const DEFAULT_BASE_SEED = 0xc0020001;
export const REPORT_DIR = 'out/test-logs/property';

export type Rng = () => number;

export type PropertyFailure<T> = {
	readonly caseIndex: number;
	readonly caseSeed: number;
	readonly input: T;
	readonly error: string;
};

export type PropertyReport<T> = {
	readonly name: string;
	readonly baseSeed: number;
	readonly runs: number;
	readonly passed: number;
	readonly failures: readonly PropertyFailure<T>[];
	readonly reproduce: string;
};

const envInt = (name: string): number | undefined => {
	const v = process.env[name];
	return v === undefined || v === '' ? undefined : Number(v) >>> 0;
};

export const runProperty = <T>(
	name: string,
	opts: {
		readonly runs: number;
		readonly generate: (rng: Rng) => T;
		/** Throw (e.g. via expect) or return a string to signal failure. */
		readonly property: (input: T) => void | string;
		readonly baseSeed?: number;
		readonly writeReport?: boolean;
	},
): PropertyReport<T> => {
	const baseSeed = envInt('MI_PROPERTY_BASE_SEED') ?? opts.baseSeed ?? DEFAULT_BASE_SEED;
	const only = envInt('MI_PROPERTY_SEED');
	const seeds =
		only !== undefined
			? [only]
			: Array.from({length: opts.runs}, (_, i) => deriveSeed(baseSeed, `${name}#${i}`));

	const failures: PropertyFailure<T>[] = [];
	seeds.forEach((caseSeed, caseIndex) => {
		const input = opts.generate(mulberry32(caseSeed));
		let error: string | undefined;
		try {
			const r = opts.property(input);
			if (typeof r === 'string') error = r;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
		if (error !== undefined) {
			failures.push({caseIndex, caseSeed, input, error});
		}
	});

	const report: PropertyReport<T> = {
		name,
		baseSeed,
		runs: seeds.length,
		passed: seeds.length - failures.length,
		failures,
		reproduce: `MI_PROPERTY_SEED=<caseSeed> npx vitest run tests/property.test.ts -t "${name}"`,
	};
	if (opts.writeReport !== false) {
		mkdirSync(REPORT_DIR, {recursive: true});
		writeFileSync(join(REPORT_DIR, `${name}.json`), JSON.stringify(report, null, 2));
	}
	return report;
};

/** Run a property and throw with full reproduction info on any failure. */
export const assertProperty = <T>(...args: Parameters<typeof runProperty<T>>): PropertyReport<T> => {
	const report = runProperty(...args);
	if (report.failures.length > 0) {
		const lines = report.failures
			.slice(0, 10)
			.map((f) => `  caseSeed=${f.caseSeed} input=${JSON.stringify(f.input)}\n    → ${f.error}`);
		throw new Error(
			`Property "${report.name}" failed ${report.failures.length}/${report.runs} (baseSeed=${report.baseSeed}).\n` +
				`${lines.join('\n')}\nReproduce: ${report.reproduce}\nReport: ${REPORT_DIR}/${report.name}.json`,
		);
	}
	return report;
};

export const uniform = (rng: Rng, min: number, max: number): number => min + rng() * (max - min);
