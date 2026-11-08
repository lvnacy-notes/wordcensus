/**
 * The analog clock: pure functions for hand angles and the countdown wedge,
 * and an SVG face that is drawn once and updated in place. Uses only standard
 * DOM APIs.
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

/** The clock's center on both axes, in viewBox units. */
const CENTER = 50;

/** The length of each hand, in viewBox units. */
const HAND_LENGTHS = {
	hour: 22,
	minute: 34,
	second: 40
};

/** Milliseconds in an hour. */
const HOUR_MS = 60 * MINUTE_MS;

/** The SVG XML namespace. */
const SVG_NS = 'http://www.w3.org/2000/svg';

/** Milliseconds in twelve hours. */
const TWELVE_HOURS_MS = 12 * HOUR_MS;

/** The radius of the countdown wedge, in viewBox units. */
const WEDGE_RADIUS = 44;

/******************************************************************************
 * Functions
******************************************************************************/

/**
 * Draws the face into `host`. The face scales to the width of its host.
 *
 * @param host - The element to draw into.
 * @returns A handle that moves the hands and resizes the wedge.
 */
export function createClockFace(host: HTMLElement): ClockFace {
	const page = host.ownerDocument;
	const svg = svgElement(
		page,
		'svg',
		{
			class: 'wordcensus-clock',
			role: 'img',
			viewBox: '0 0 100 100'
		}
	);
	svg.appendChild(svgElement(
		page,
		'circle',
		{
			class: 'wordcensus-clock-face',
			cx: String(CENTER),
			cy: String(CENTER),
			r: '48'
		}
	));
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
 * Computes hand rotations for a duration. The second hand turns once a
 * minute, the minute hand once an hour, and the hour hand once in twelve
 * hours. Negative and non-finite values read as zero.
 *
 * @param ms - The duration in milliseconds.
 * @returns The rotation of each hand, in degrees.
 */
export function handAngles(ms: number): HandAngles {
	const safe = Number.isFinite(ms) ? Math.max(0, ms) : 0;
	return {
		hour: ((safe % TWELVE_HOURS_MS) / TWELVE_HOURS_MS) * 360,
		minute: ((safe % HOUR_MS) / HOUR_MS) * 360,
		second: ((safe % MINUTE_MS) / MINUTE_MS) * 360
	};
}

/**
 * Creates a clock hand pointing at twelve o'clock.
 *
 * @param page - The document that shows the clock.
 * @param name - Which hand to create.
 * @returns The hand's line element.
 */
function handElement(page: Document, name: 'hour' | 'minute' | 'second'): SVGElement {
	return svgElement(
		page,
		'line',
		{
			class: `wordcensus-clock-hand wordcensus-clock-hand-${ name }`,
			x1: String(CENTER),
			x2: String(CENTER),
			y1: String(CENTER),
			y2: String(CENTER - HAND_LENGTHS[name])
		}
	);
}

/**
 * Builds an SVG rotation about the clock's center.
 *
 * @param degrees - The rotation in degrees.
 * @returns The `rotate(...)` transform value.
 */
function rotation(degrees: number): string {
	return `rotate(${ roundTo(degrees) } ${ CENTER } ${ CENTER })`;
}

/**
 * Rounds to three decimal places.
 *
 * @param value - The number to round.
 * @returns The rounded number.
 */
function roundTo(value: number): number {
	return Math.round(value * 1000) / 1000;
}

/**
 * Creates an SVG element in `page`, the document of the window that shows the
 * clock.
 *
 * @param page - The document to create the element in.
 * @param tag - The SVG tag name.
 * @param attributes - The attributes to set.
 * @returns The new element.
 */
function svgElement(
	page: Document,
	tag: string,
	attributes: Record<string, string>
): SVGElement {
	const element = page.createElementNS(SVG_NS, tag);
	for (const [name, value] of Object.entries(attributes)) {
		element.setAttribute(name, value);
	}
	return element;
}

/**
 * Creates one of the twelve hour ticks; every third tick is longer.
 *
 * @param page - The document that shows the clock.
 * @param index - The tick's position, 0 to 11, clockwise from twelve o'clock.
 * @returns The tick's line element.
 */
function tickMark(page: Document, index: number): SVGElement {
	const mark = svgElement(
		page,
		'line',
		{
			class: 'wordcensus-clock-tick',
			x1: String(CENTER),
			x2: String(CENTER),
			y1: '4',
			y2: index % 3 === 0 ? '10' : '7'
		}
	);
	mark.setAttribute('transform', rotation(index * 30));
	return mark;
}

/**
 * Builds the SVG path of a pie wedge that starts at twelve o'clock and sweeps
 * clockwise over `fraction` of the face. The path is empty for zero or less
 * and a full disc for one or more.
 *
 * @param fraction - The fraction of the face to cover.
 * @returns The path's `d` attribute value.
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