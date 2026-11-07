/**
 * Draws the sidebar panel: region summary, mode selector, clock, mode data
 * and controls. It renders a `PanelModel` and reports what the user does
 * through `PanelActions`; it holds no state of its own. Elements are built
 * with Obsidian's global `createEl`; everything else is standard DOM.
 */

import { createClockFace } from './clock-face';
import { MAX_COUNTDOWN_MINUTES, MIN_COUNTDOWN_MINUTES } from '../settings/settings';
import { TIMER_MODES } from '../timer/timer';
import type {
	Panel,
	PanelActions,
	PanelModel,
	TimerMode
} from '../types';

/******************************************************************************
 * Declared Variables and Constants
******************************************************************************/

const MODE_LABELS: Readonly<Record<TimerMode, string>> = {
	countdown: 'Countdown',
	session: 'Session',
	stopwatch: 'Stopwatch'
};

/******************************************************************************
 * Functions
******************************************************************************/

function buildButton(label: string, className: string): HTMLButtonElement {
	const button = element('button', className, label);
	button.type = 'button';
	return button;
}

/** Builds the panel inside `host`. */
export function createPanel(host: HTMLElement, actions: PanelActions): Panel {
	const root = element('div', 'wordcensus-panel');

	const summary = root.appendChild(element('div', 'wordcensus-summary'));
	const headline = summary.appendChild(element('div', 'wordcensus-summary-headline'));
	const detail = summary.appendChild(element('div', 'wordcensus-summary-detail'));

	const pill = root.appendChild(element('div', 'wordcensus-modes'));
	pill.setAttribute('role', 'group');
	pill.setAttribute('aria-label', 'Timer mode');
	const modeButtons = new Map<TimerMode, HTMLButtonElement>();
	for (const mode of TIMER_MODES) {
		const button = pill.appendChild(buildButton(MODE_LABELS[mode], 'wordcensus-mode'));
		button.addEventListener('click', () => actions.onMode(mode));
		modeButtons.set(mode, button);
	}

	const clockHost = root.appendChild(element('div', 'wordcensus-clock-host'));
	const clock = createClockFace(clockHost);

	const rows = root.appendChild(element('div', 'wordcensus-rows'));

	const durationLabel = root.appendChild(element('label', 'wordcensus-duration'));
	durationLabel.appendChild(element('span', 'wordcensus-duration-label', 'Countdown minutes'));
	const durationInput = durationLabel.appendChild(element('input', 'wordcensus-duration-input'));
	durationInput.type = 'number';
	durationInput.min = String(MIN_COUNTDOWN_MINUTES);
	durationInput.max = String(MAX_COUNTDOWN_MINUTES);
	durationInput.step = '1';
	durationInput.inputMode = 'numeric';
	durationInput.addEventListener('change', () => {
		const minutes = Number(durationInput.value);
		if (Number.isFinite(minutes) && minutes > 0) {
			actions.onDuration(minutes);
		}
	});

	const controls = root.appendChild(element('div', 'wordcensus-controls'));
	const toggle = controls.appendChild(buildButton('Start', 'wordcensus-toggle'));
	toggle.addEventListener('click', () => actions.onToggle());
	const reset = controls.appendChild(buildButton('Reset', 'wordcensus-reset'));
	reset.addEventListener('click', () => actions.onReset());

	host.appendChild(root);

	return {
		destroy(): void {
			root.remove();
		},
		update(model: PanelModel): void {
			headline.textContent = model.summary.headline;
			detail.textContent = model.summary.detail;

			for (const [mode, button] of modeButtons) {
				const selected = mode === model.mode;
				button.setAttribute('aria-pressed', String(selected));
				button.classList.toggle('is-active', selected);
			}

			clock.update(model.clock);

			rows.replaceChildren(...model.rows.map((row) => {
				const line = element('div', 'wordcensus-row');
				line.appendChild(element('span', 'wordcensus-row-label', row.label));
				line.appendChild(element('span', 'wordcensus-row-value', row.value));
				return line;
			}));

			durationLabel.hidden = model.durationMinutes === null;
			durationInput.disabled = !model.durationEditable;
			// Compared in the input's own document, which is a popout window's when the panel is popped out.
			const typing = durationInput.ownerDocument.activeElement === durationInput;
			if (model.durationMinutes !== null && !typing) {
				durationInput.value = String(model.durationMinutes);
			}

			toggle.textContent = model.running ? 'Pause' : 'Start';
			toggle.disabled = model.startDisabled && !model.running;
		}
	};
}

function element<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	className: string,
	text = ''
): HTMLElementTagNameMap[K] {
	const created = createEl(tag);
	created.className = className;
	created.textContent = text;
	return created;
}