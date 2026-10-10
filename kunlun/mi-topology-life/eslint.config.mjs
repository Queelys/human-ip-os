import js from '@eslint/js';
import {makeConfig} from '@remotion/eslint-config-flat';
import globals from 'globals';

const remotion = makeConfig({remotionDir: 'src/**/*.{ts,tsx}'});

/** Determinism guardrails: animation must be driven by the frame number only. */
const determinismRules = {
	'no-restricted-properties': [
		'error',
		{object: 'Math', property: 'random', message: 'Use createRng(seed, label) from src/core/rng.'},
		{object: 'Date', property: 'now', message: 'Wall-clock time is non-deterministic; use useCurrentFrame().'},
		{object: 'performance', property: 'now', message: 'Wall-clock time is non-deterministic; use useCurrentFrame().'},
	],
	'no-restricted-imports': [
		'error',
		{
			paths: [
				{
					name: '@react-three/fiber',
					importNames: ['useFrame'],
					message: 'useFrame is delta-time driven; derive motion from useCurrentFrame().',
				},
			],
		},
	],
	'no-restricted-syntax': [
		'error',
		{selector: "NewExpression[callee.name='Date']", message: 'new Date() is non-deterministic.'},
		{selector: "NewExpression[callee.name='Clock']", message: 'THREE.Clock is non-deterministic.'},
	],
};

export default [
	{ignores: ['node_modules/**', 'build/**', 'out/**']},
	...remotion.map((c) => ({...c, files: ['src/**/*.{ts,tsx}', 'tests/**/*.ts']})),
	{files: ['src/**/*.{ts,tsx}'], rules: determinismRules},
	{
		files: ['scripts/**/*.mjs'],
		...js.configs.recommended,
		languageOptions: {globals: globals.node, sourceType: 'module', ecmaVersion: 2022},
	},
];
