import { defineConfig } from 'eslint/config';
import stylistic from '@stylistic/eslint-plugin';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import obs from 'eslint-plugin-obsidianmd';

export default defineConfig([
	...obs.configs.recommended,
	{
		ignores: [
			'.coverage/report/**',
			'.obsidian/**',
			'dist/**',
			'node_modules/**',
			'test/**',
			'*.map',
			// Generated build output, not hand-written source - see
			// .gitignore.
			'main.js'
		]
	},
	{
		// Shared parser and rules for every hand-written file, JS and TS
		// alike - a plain Node.js tooling script gets the same stylistic
		// and JS-quality rules as application source. Type-aware rules
		// that need `parserOptions.project` live in their own block below,
		// scoped to only the files tsconfig.json actually covers.
		files: ['**/*.ts', '**/*.js'],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				ecmaVersion: 2020,
				sourceType: 'module'
			},
			globals: {
				console: 'readonly',
				process: 'readonly',
				Buffer: 'readonly',
				global: 'readonly'
			}
		},
		linterOptions: {
			reportUnusedDisableDirectives: 'error',
			reportUnusedInlineConfigs: 'error'
		},
		plugins: {
			'@stylistic': stylistic,
			'@typescript-eslint': tseslint
		},
		rules: {
			// Core JavaScript rules from carnival config
			'curly': 'warn',
			'default-case-last': 'error',
			'max-classes-per-file': [
				'error',
				{
					'ignoreExpressions': true
				}
			],
			'new-cap': 'error',
			'no-console': [
				'warn',
				{
					allow: [
						'group',
						'groupCollapsed',
						'groupEnd',
						'warn',
						'error'
					]
				}
			],
			'no-eval': 'error',
			'no-extra-boolean-cast': 'error',
			'no-implied-eval': 'error',
			'no-invalid-this': 'off', // Handled by TypeScript
			'no-multi-assign': 'error',
			'no-param-reassign': 'error',
			'no-prototype-builtins': 'off',
			'no-shadow': 'off', // Use TypeScript version
			'no-undef': 'off', // TypeScript handles this
			'no-unexpected-multiline': 'off',
			'no-unused-vars': 'off', // Use TypeScript version
			'no-use-before-define': 'off', // Use TypeScript version
			'no-useless-assignment': 'warn',
			'no-useless-rename': 'warn',
			'no-var': 'error',
			'prefer-const': 'warn',
			'prefer-destructuring': [
				'error',
				{
					'array': false,
					'object': true
				}
			],
			'prefer-template': 'warn',
			'require-atomic-updates': 'error',
			'require-await': 'warn',
			'yoda': 'error',

			// TypeScript-specific rules
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{
					'argsIgnorePattern': '^_',
					'varsIgnorePattern': '^_'
				}
			],
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-non-null-assertion': 'warn',
			'@typescript-eslint/no-shadow': 'error',
			'@typescript-eslint/no-use-before-define': [
				'error',
				{
					'functions': false,
					'classes': false,
					'variables': true
				}
			],

			// Stylistic rules adapted from carnival config
			'@stylistic/indent': ['error', 'tab'],
			'@stylistic/no-mixed-spaces-and-tabs': 'error',
			'@stylistic/object-curly-spacing': ['error', 'always'],
			'@stylistic/quotes': [
				'error',
				'single',
				{
					'allowTemplateLiterals': 'always',
					'avoidEscape': true
				}
			],
			'@stylistic/semi': ['error', 'always'],

			// "Word Census" is this plugin's own proper noun and should keep
			// its capitalization in UI text, same as the rule's own
			// built-in brands (Obsidian, GitHub, etc). The `brands` option
			// is the rule's documented extension point for exactly this -
			// not an eslint-disable, which eslint-plugin-obsidianmd's
			// recommended config hard-blocks for every obsidianmd/* rule
			// (see eslint-comments/no-restricted-disable below).
			'obsidianmd/ui/sentence-case': ['warn', { brands: ['Word Census'] }],

			// eslint-plugin-obsidianmd's own recommended config (spread at
			// the top of this file) already registers the
			// `eslint-comments` plugin and sets this rule to block
			// disabling a specific list of rules (every obsidianmd/* rule,
			// no-console, no-explicit-any, and a handful of others) -
			// not eslint-disable comments in general. Overriding it here
			// with the wildcard pattern widens that to every rule, so
			// eslint-disable is never an escape hatch anywhere, in any
			// file: eslint-comments/no-unlimited-disable (also from that
			// same recommended config) already requires every disable to
			// name a specific rule rather than silencing the whole line;
			// the wildcard here closes the other half of the same gap, so
			// naming a rule doesn't help either.
			'eslint-comments/no-restricted-disable': ['error', '*']
		}
	},
	{
		// Type-aware rules need `parserOptions.project`, which needs the
		// file to actually be inside tsconfig.json's `include`
		// (**/*.ts only - no .js files, ever). Scoping this to the same
		// extension keeps that in sync by construction rather than by
		// remembering to update two places - and this is the block that
		// would throw typescript-eslint's
		// "none-of-those-tsconfigs-include-this-file" parsing error if a
		// plain .js file ever ended up in it.
		files: ['**/*.ts'],
		languageOptions: {
			parserOptions: {
				project: './tsconfig.json'
			}
		},
		rules: {
			'@typescript-eslint/prefer-nullish-coalescing': 'error',
			'@typescript-eslint/prefer-optional-chain': 'error',
			'@typescript-eslint/no-unnecessary-type-assertion': 'error'
		}
	},
	{
		// Plain Node.js tooling: build scripts and CI scripts that only
		// ever run in Node itself (a contributor's machine, GitHub
		// Actions) - never inside Obsidian's sandboxed plugin process.
		// The obsidianmd/* rules exist to protect plugin runtime code
		// specifically (no direct Node.js module access, no console
		// output where Obsidian's Notice API is expected) and don't mean
		// anything for code whose entire job is Node.js I/O and console
		// output.
		files: [
			'esbuild.config.js',
			'version-bump.js',
			'vitest.config.js',
			'eslint.config.js',
			'.coverage/check-coverage-ratchet.js'
		],
		rules: {
			'obsidianmd/no-nodejs-modules': 'off',
			'obsidianmd/rule-custom-message': 'off',
			// Only false-positives on this file specifically (eslint.config.js
			// itself, via the '.obsidian/**' string in the ignores list above)
			// - that's a glob pattern for what the linter should skip, not a
			// runtime path used to reach into a vault. Harmless to leave on
			// for the others in this list; it just never fires there.
			'obsidianmd/hardcoded-config-path': 'off',
			// A separate rule from obsidianmd/rule-custom-message above -
			// this project's own general no-console rule (see the shared
			// rules block) restricts plugin runtime code to warn/error/
			// group-style output. A CLI script's entire job is printing
			// informational status - check-coverage-ratchet.js's own
			// passing-case output is exactly that, not an error.
			'no-console': 'off'
		}
	}
]);
