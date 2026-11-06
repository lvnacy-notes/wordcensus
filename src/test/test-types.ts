/**
 * Exported types and interfaces used only by tests.
 */

import type { DriverEnvironment, Persistence } from '../types';

export interface FakeEnvironment extends DriverEnvironment {
	cancelled: number;
	goToBackground(): void;
	notices: string[];
	returnToForeground(): void;
	scheduled: number;
	tick(): void;
	time: number;
}

export interface FakePersistence {
	persistence: Persistence;
	saved: unknown[];
}