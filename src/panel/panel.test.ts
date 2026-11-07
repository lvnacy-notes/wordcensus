import {
	afterEach,
	describe,
	expect,
	it
} from 'vitest';
import { createPanel } from './panel';
import type {
	Panel,
	PanelActions,
	PanelModel,
	TimerMode
} from '../types';

interface Calls {
	durations: number[];
	modes: TimerMode[];
	resets: number;
	toggles: number;
}

interface Rendered {
	calls: Calls;
	host: HTMLElement;
	panel: Panel;
}

const hosts: HTMLElement[] = [];

function buildModel(overrides: Partial<PanelModel> = {}): PanelModel {
	return {
		clock: { ms: 0, wedge: null },
		durationEditable: false,
		durationMinutes: null,
		mode: 'stopwatch',
		rows: [{ label: 'Elapsed', value: '0:00' }],
		running: false,
		startDisabled: false,
		summary: { detail: 'Whole note', headline: '12 words' },
		...overrides
	};
}

/** The document of a new frame, standing in for the document of a popout window. */
function openWindow(): Document {
	const frame = createEl('iframe');
	document.body.appendChild(frame);
	hosts.push(frame);
	if (frame.contentDocument === null) {
		throw new Error('missing frame document');
	}
	return frame.contentDocument;
}

function render(page: Document = document): Rendered {
	const calls: Calls = {
		durations: [],
		modes: [],
		resets: 0,
		toggles: 0
	};
	const actions: PanelActions = {
		onDuration: (minutes) => {
			calls.durations.push(minutes);
		},
		onMode: (mode) => {
			calls.modes.push(mode);
		},
		onReset: () => {
			calls.resets += 1;
		},
		onToggle: () => {
			calls.toggles += 1;
		}
	};
	const host = createDiv();
	page.body.appendChild(host);
	hosts.push(host);
	return {
		calls,
		host,
		panel: createPanel(host, actions)
	};
}

function find<T extends HTMLElement>(host: HTMLElement, selector: string): T {
	const found = host.querySelector<T>(selector);
	if (found === null) {
		throw new Error(`missing ${ selector }`);
	}
	return found;
}

afterEach(() => {
	for (const host of hosts.splice(0)) {
		host.remove();
	}
});

describe('createPanel', () => {
	it('shows the summary and the mode data', () => {
		const { host, panel } = render();

		panel.update(buildModel());

		expect(find(host, '.wordcensus-summary-headline').textContent).toBe('12 words');
		expect(find(host, '.wordcensus-summary-detail').textContent).toBe('Whole note');
		expect(find(host, '.wordcensus-row').textContent).toBe('Elapsed0:00');
	});

	it('marks the selected mode and reports a click on another', () => {
		const { calls, host, panel } = render();
		panel.update(buildModel({ mode: 'countdown' }));
		const buttons = Array.from(host.querySelectorAll<HTMLButtonElement>('.wordcensus-mode'));

		buttons[2]?.click();

		expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual([
			'false',
			'true',
			'false'
		]);
		expect(calls.modes).toEqual(['session']);
	});

	it('labels the toggle for what it will do and reports clicks', () => {
		const { calls, host, panel } = render();
		const toggle = find<HTMLButtonElement>(host, '.wordcensus-toggle');

		panel.update(buildModel({ running: false }));
		const idleLabel = toggle.textContent;
		toggle.click();
		panel.update(buildModel({ running: true }));

		expect(idleLabel).toBe('Start');
		expect(toggle.textContent).toBe('Pause');
		expect(calls.toggles).toBe(1);
	});

	it('disables Start for a finished countdown, but never Pause', () => {
		const { host, panel } = render();
		const toggle = find<HTMLButtonElement>(host, '.wordcensus-toggle');

		panel.update(buildModel({ startDisabled: true }));
		const whenFinished = toggle.disabled;
		panel.update(buildModel({ running: true, startDisabled: true }));

		expect(whenFinished).toBe(true);
		expect(toggle.disabled).toBe(false);
	});

	it('reports a click on Reset', () => {
		const { calls, host, panel } = render();
		panel.update(buildModel());

		find<HTMLButtonElement>(host, '.wordcensus-reset').click();

		expect(calls.resets).toBe(1);
	});

	describe('countdown length', () => {
		it('shows the input only for a countdown, and locks it while running', () => {
			const { host, panel } = render();
			const label = find(host, '.wordcensus-duration');
			const input = find<HTMLInputElement>(host, '.wordcensus-duration-input');

			panel.update(buildModel());
			const hiddenOutsideCountdown = label.hidden;
			panel.update(buildModel({
				durationEditable: true,
				durationMinutes: 25,
				mode: 'countdown'
			}));
			const editable = !input.disabled;
			panel.update(buildModel({
				durationEditable: false,
				durationMinutes: 25,
				mode: 'countdown',
				running: true
			}));

			expect(hiddenOutsideCountdown).toBe(true);
			expect(label.hidden).toBe(false);
			expect(editable).toBe(true);
			expect(input.disabled).toBe(true);
			expect(input.value).toBe('25');
		});

		it('reports a valid change and ignores a blank or non-positive one', () => {
			const { calls, host, panel } = render();
			panel.update(buildModel({
				durationEditable: true,
				durationMinutes: 25,
				mode: 'countdown'
			}));
			const input = find<HTMLInputElement>(host, '.wordcensus-duration-input');

			for (const value of ['15', '', '0']) {
				input.value = value;
				input.dispatchEvent(new Event('change'));
			}

			expect(calls.durations).toEqual([15]);
		});

		it('does not overwrite what the user is typing', () => {
			const { host, panel } = render();
			const model = buildModel({
				durationEditable: true,
				durationMinutes: 25,
				mode: 'countdown'
			});
			panel.update(model);
			const input = find<HTMLInputElement>(host, '.wordcensus-duration-input');
			input.focus();
			input.value = '3';

			panel.update(model);

			expect(input.value).toBe('3');
		});

		it('does not overwrite what the user is typing in another window', () => {
			const { host, panel } = render(openWindow());
			const model = buildModel({
				durationEditable: true,
				durationMinutes: 25,
				mode: 'countdown'
			});
			panel.update(model);
			const input = find<HTMLInputElement>(host, '.wordcensus-duration-input');
			input.focus();
			input.value = '3';

			panel.update(model);

			expect(input.value).toBe('3');
		});
	});

	it('removes itself from the page', () => {
		const { host, panel } = render();

		panel.destroy();

		expect(host.querySelector('.wordcensus-panel')).toBeNull();
	});
});