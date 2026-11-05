import { defineConfig } from 'vitest/config';

// Why each setting is what it is: docs/TESTING.md, "Vitest configuration".
export default defineConfig({
	resolve: {
		alias: {
			obsidian: 'obsidian-test-mocks/obsidian',
		},
	},
	test: {
		environment: 'jsdom',
		pool: 'vmThreads',
		setupFiles: ['obsidian-test-mocks/vitest-setup'],
		include: ['src/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			reporter: [
				'text',
				'html',
				'json',
				'json-summary'
			],
			reportsDirectory: '.coverage/report',
			include: ['src/**/*.ts'],
			thresholds: {
				lines: 0,
				functions: 0,
				branches: 0,
				statements: 0,
			},
		},
	},
});