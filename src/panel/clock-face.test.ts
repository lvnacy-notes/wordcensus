import {
	afterEach,
	describe,
	expect,
	it
} from 'vitest';
import {
	createClockFace,
	handAngles,
	wedgePath
} from './clock-face';

const MINUTE = 60_000;
const HOUR = 3_600_000;

const hosts: HTMLElement[] = [];

function buildHost(): HTMLElement {
	const host = createDiv();
	document.body.appendChild(host);
	hosts.push(host);
	return host;
}

function attribute(host: HTMLElement, selector: string, name: string): string | null {
	return host.querySelector(selector)?.getAttribute(name) ?? null;
}

afterEach(() => {
	for (const host of hosts.splice(0)) {
		host.remove();
	}
});

describe('handAngles', () => {
	it('turns the second hand once a minute', () => {
		expect(handAngles(15_000).second).toBe(90);
		expect(handAngles(MINUTE).second).toBe(0);
	});

	it('turns the minute hand once an hour and the hour hand once in twelve', () => {
		const angles = handAngles(30 * MINUTE);

		expect(angles.minute).toBe(180);
		expect(angles.hour).toBe(15);
		expect(handAngles(12 * HOUR).hour).toBe(0);
	});

	it('reads negative and non-finite values as zero', () => {
		expect(handAngles(-5000)).toEqual({ hour: 0, minute: 0, second: 0 });
		expect(handAngles(Number.NaN)).toEqual({ hour: 0, minute: 0, second: 0 });
	});
});

describe('wedgePath', () => {
	it('is empty when nothing remains', () => {
		expect(wedgePath(0)).toBe('');
	});

	it('sweeps clockwise from twelve o\'clock with the right arc flags', () => {
		expect(wedgePath(0.25)).toBe('M 50 50 L 50 6 A 44 44 0 0 1 94 50 Z');
		expect(wedgePath(0.75)).toBe('M 50 50 L 50 6 A 44 44 0 1 1 6 50 Z');
	});

	it('is a full disc at one or more', () => {
		expect(wedgePath(1)).toBe(wedgePath(2));
		expect(wedgePath(1).split('A').length).toBe(3);
	});
});

describe('createClockFace', () => {
	it('rotates the hands to the model', () => {
		const host = buildHost();
		const face = createClockFace(host);

		face.update({ ms: 15_000, wedge: null });

		expect(attribute(host, '.wordcensus-clock-hand-second', 'transform')).toBe('rotate(90 50 50)');
	});

	it('builds the face in the document of its host', () => {
		const frame = createEl('iframe');
		document.body.appendChild(frame);
		hosts.push(frame);
		const page = frame.contentDocument;
		if (page === null) {
			throw new Error('missing frame document');
		}
		const host = createDiv();
		page.body.appendChild(host);

		createClockFace(host);

		expect(host.querySelector('svg')?.ownerDocument).toBe(page);
	});

	it('shows the wedge only when the model has one', () => {
		const host = buildHost();
		const face = createClockFace(host);

		face.update({ ms: 0, wedge: 0.25 });
		const withWedge = attribute(host, '.wordcensus-clock-wedge', 'd');
		face.update({ ms: 0, wedge: null });
		const withoutWedge = attribute(host, '.wordcensus-clock-wedge', 'd');

		expect(withWedge).toBe('M 50 50 L 50 6 A 44 44 0 0 1 94 50 Z');
		expect(withoutWedge).toBe('');
	});
});