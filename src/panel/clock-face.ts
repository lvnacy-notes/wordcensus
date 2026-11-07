/**
 * The analog clock: pure functions for hand angles and the countdown wedge,
 * and an SVG face that is drawn once and then updated in place. Uses only
 * standard DOM APIs.
 */

import { MINUTE_MS } from '../timer/timer';
import type {
	ClockFace,
	ClockModel,
	HandAngles
} from '../types';

/******************************************************************************
 * Declared Variables and Constants
******************************************************************************/

const CENTER = 50;
const HAND_LENGTHS = {
	hour: 22,
	minute: 34,
	second: 40
};
const HOUR_MS = 60 * MINUTE_MS;
const SVG_NS = 'http://www.w3.org/2000/svg';
const TWELVE_HOURS_MS = 12 * HOUR_MS;
const WEDGE_RADIUS = 44;

/******************************************************************************
 * Functions
******************************************************************************/

/**
 * Draws the face into `host` and returns a handle that moves the hands and
 * resizes the wedge. The face scales to the width of its host.
 */
export function createClockFace(host: HTMLElement): ClockFace {
	const page = host.ownerDocument;
	const svg = svgElement(page, 'svg', {
		class: 'wordcensus-clock',
		role: 'img',
		viewBox: '0 0 100 100'
	});
	svg.appendChild(svgElement(
		page,
		'circle',
		{
			class: 'wordcensus-clock-face',
			cx: String(CENTER),
			cy: String(CENTER),
			r: '48'
		}));
	const wedge = svg.appendChild(svgElement(
		page,
		'path',
		{ class: 'wordcensus-clock-wedge' }
	));
	for (let tick = 0; tick < 12; tick += 1) {
		svg.appendChild(tickMark(page, tick));
	}
	const hour = svg.appendChild(handElement(page, 'hour'));
	const minute = svg.appendChild(handElement(page, 'minute'));
	const second = svg.appendChild(handElement(page, 'second'));
	host.appendChild(svg);

	return {
		update(model: ClockModel): void {
			const angles = handAngles(model.ms);
			hour.setAttribute('transform', rotation(angles.hour));
			minute.setAttribute('transform', rotation(angles.minute));
			second.setAttribute('transform', rotation(angles.second));
			wedge.setAttribute('d', model.wedge === null ? '' : wedgePath(model.wedge));
		}
	};
}

/**
 * Hand rotations for a duration. The second hand turns once a minute, the
 * minute hand once an hour and the hour hand once in twelve hours. Negative
 * and non-finite values read as zero.
 */
export function handAngles(ms: number): HandAngles {
	const safe = Number.isFinite(ms) ? Math.max(0, ms) : 0;
	return {
		hour: ((safe % TWELVE_HOURS_MS) / TWELVE_HOURS_MS) * 360,
		minute: ((safe % HOUR_MS) / HOUR_MS) * 360,
		second: ((safe % MINUTE_MS) / MINUTE_MS) * 360
	};
}

function handElement(page: Document, name: 'hour' | 'minute' | 'second'): SVGElement {
	return svgElement(page, 'line', {
		class: `wordcensus-clock-hand wordcensus-clock-hand-${ name }`,
		x1: String(CENTER),
		x2: String(CENTER),
		y1: String(CENTER),
		y2: String(CENTER - HAND_LENGTHS[name])
	});
}

function rotation(degrees: number): string {
	return `rotate(${ roundTo(degrees) } ${ CENTER } ${ CENTER })`;
}

function roundTo(value: number): number {
	return Math.round(value * 1000) / 1000;
}

/** Creates an SVG element in `page`, the document of the window that shows the clock. */
function svgElement(page: Document, tag: string, attributes: Record<string, string>): SVGElement {
	const element = page.createElementNS(SVG_NS, tag);
	for (const [name, value] of Object.entries(attributes)) {
		element.setAttribute(name, value);
	}
	return element;
}

function tickMark(page: Document, index: number): SVGElement {
	const mark = svgElement(page, 'line', {
		class: 'wordcensus-clock-tick',
		x1: String(CENTER),
		x2: String(CENTER),
		y1: '4',
		y2: index % 3 === 0 ? '10' : '7'
	});
	mark.setAttribute('transform', rotation(index * 30));
	return mark;
}

/**
 * The SVG path of a pie wedge that starts at twelve o'clock and sweeps
 * clockwise over `fraction` of the face. Empty for zero or less; a full disc
 * for one or more.
 */
export function wedgePath(fraction: number): string {
	if (!Number.isFinite(fraction) || fraction <= 0) {
		return '';
	}
	const top = CENTER - WEDGE_RADIUS;
	if (fraction >= 1) {
		const diameter = WEDGE_RADIUS * 2;
		return `M ${ CENTER } ${ top } A ${ WEDGE_RADIUS } ${ WEDGE_RADIUS } 0 1 1 ${ CENTER } ${ top + diameter } A ${ WEDGE_RADIUS } ${ WEDGE_RADIUS } 0 1 1 ${ CENTER } ${ top } Z`;
	}
	const radians = fraction * 2 * Math.PI;
	const x = roundTo(CENTER + WEDGE_RADIUS * Math.sin(radians));
	const y = roundTo(CENTER - WEDGE_RADIUS * Math.cos(radians));
	const largeArc = fraction > 0.5 ? 1 : 0;
	return `M ${ CENTER } ${ CENTER } L ${ CENTER } ${ top } A ${ WEDGE_RADIUS } ${ WEDGE_RADIUS } 0 ${ largeArc } 1 ${ x } ${ y } Z`;
}