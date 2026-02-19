import { clamp, log, packLineData } from '../utils.js';
import { DeviceBase } from './DeviceBase.js';
import {
	GET_GRID_SIZE,
	GRID_KEY_DOWN,
	GRID_KEY_UP,
	GRID_LED,
	GRID_LED_ALL,
	GRID_LED_COL,
	GRID_LED_INTENSITY,
	GRID_LED_LEVEL,
	GRID_LED_LEVEL_ALL,
	GRID_LED_LEVEL_COL,
	GRID_LED_LEVEL_MAP,
	GRID_LED_LEVEL_ROW,
	GRID_LED_MAP,
	GRID_LED_ROW,
	SEND_GET_GRID_SIZE,
	SEND_GET_ID,
	SEND_QUERY,
} from '../events.js';

/* eslint-disable no-unused-vars */

/* input from series device */
const PROTO_SERIES_BUTTON_DOWN = 0x00;
const PROTO_SERIES_BUTTON_UP = 0x10;
const PROTO_SERIES_TILT = 0xd0;
const PROTO_SERIES_AUX_INPUT = 0xe0;

/* output from series device  */
const PROTO_SERIES_LED_ON = 0x20;
const PROTO_SERIES_LED_OFF = 0x30;
const PROTO_SERIES_LED_ROW_8 = 0x40;
const PROTO_SERIES_LED_COL_8 = 0x50;
const PROTO_SERIES_LED_ROW_16 = 0x60;
const PROTO_SERIES_LED_COL_16 = 0x70;
const PROTO_SERIES_LED_FRAME = 0x80;
const PROTO_SERIES_CLEAR = 0x90;
const PROTO_SERIES_INTENSITY = 0xa0;
const PROTO_SERIES_MODE = 0xb0;
const PROTO_SERIES_AUX_PORT_ACTIVATE = 0xc0;
const PROTO_SERIES_AUX_PORT_DEACTIVATE = 0xd0;

/* eslint-enable no-unused-vars */

const SERIES_GRID_SIZES = {
	64: { x: 8, y: 8 },
	128: { x: 16, y: 8 },
	256: { x: 16, y: 16 },
};

export class GridSeries extends DeviceBase {
	constructor(device, m) {
		super(device, m);
		this.bindEvents();
	}

	bindEvents() {
		const m = this.m;
		const opts = { signal: this.abort.signal };

		m.addEventListener(
			SEND_QUERY,
			() => {
				log('query is not supported on series devices', 1);
			},
			opts
		);

		m.addEventListener(
			SEND_GET_ID,
			() => {
				log('getId is not supported on series devices', 1);
			},
			opts
		);

		m.addEventListener(
			SEND_GET_GRID_SIZE,
			() => {
				const match = this.device.serialNumber.match(/^m(64|128|256)/);
				if (!match) {
					log('could not determine series grid size from serial number', 1);
					return;
				}
				const size = SERIES_GRID_SIZES[match[1]];
				m.emit(GET_GRID_SIZE, size);
			},
			opts
		);

		// reusable led calls for sharing with normal and degradation paths
		const gridLed = (x, y, on) => {
			this.write([
				on ? PROTO_SERIES_LED_ON : PROTO_SERIES_LED_OFF,
				(x << 4) | y,
			]);
		};

		const gridLedAll = (on) => {
			this.write([PROTO_SERIES_CLEAR | (on & 0x01)]);
		};

		const gridLedCol = (x, y, state) => {
			const mode =
				state.length === 8 ? PROTO_SERIES_LED_COL_8 : PROTO_SERIES_LED_COL_16;
			this.write([mode | (x & 0x0f), packLineData(state)]);
		};

		const gridLedRow = (x, y, state) => {
			const mode =
				state.length === 8 ? PROTO_SERIES_LED_ROW_8 : PROTO_SERIES_LED_ROW_16;
			this.write([mode | (y & 0x0f), packLineData(state)]);
		};

		const gridLedMap = (x, y, state) => {
			const quadrant = Math.floor(x / 8) + Math.floor(y / 8) * 2;
			const data = [0, 0, 0, 0, 0, 0, 0, 0];
			for (let i = 0; i < Math.min(64, state.length); i++) {
				const byteIndex = Math.floor(i / 8);
				const bitIndex = i % 8;
				data[byteIndex] = data[byteIndex] | (clamp(state[i], 0, 1) << bitIndex);
			}
			this.write([PROTO_SERIES_LED_FRAME | (quadrant & 0x03), ...data]);
		};

		const gridLedIntensity = (intensity) => {
			this.write([PROTO_SERIES_INTENSITY | (clamp(intensity, 0, 15) & 0x0f)]);
		};

		m.addEventListener(
			GRID_LED,
			({ detail: { x, y, on } }) => {
				gridLed(x, y, on);
			},
			opts
		);

		m.addEventListener(
			GRID_LED_ALL,
			({ detail: { on } }) => {
				gridLedAll(on);
			},
			opts
		);

		// y offset is seemingly ignored in the serial protocol?
		// see: https://github.com/monome/libmonome/blob/cd11b2fde61b7ecd1c171cf9f8568918b0199df9/src/proto/series.c#L184
		m.addEventListener(
			GRID_LED_COL,
			({ detail: { x, y, state } }) => {
				gridLedCol(x, y, state);
			},
			opts
		);

		// x offset is seemingly ignored in the serial protocol?
		// see: https://github.com/monome/libmonome/blob/cd11b2fde61b7ecd1c171cf9f8568918b0199df9/src/proto/series.c#L209
		m.addEventListener(
			GRID_LED_ROW,
			({ detail: { x, y, state } }) => {
				gridLedRow(x, y, state);
			},
			opts
		);

		m.addEventListener(
			GRID_LED_MAP,
			({ detail: { x, y, state } }) => {
				gridLedMap(x, y, state);
			},
			opts
		);

		m.addEventListener(
			GRID_LED_INTENSITY,
			({ detail: { intensity } }) => {
				gridLedIntensity(intensity);
			},
			opts
		);

		m.addEventListener(
			GRID_LED_LEVEL,
			({ detail: { x, y, level } }) => {
				log('series does not support LED levels, degrading to on/off', 1);
				gridLed(x, y, level > 7);
			},
			opts
		);

		m.addEventListener(
			GRID_LED_LEVEL_ALL,
			({ detail: { level } }) => {
				log('series does not support LED levels, degrading to intensity', 1);
				gridLedIntensity(level);
			},
			opts
		);

		m.addEventListener(
			GRID_LED_LEVEL_COL,
			({ detail: { x, y, state } }) => {
				log('series does not support LED levels, degrading to on/off', 1);
				gridLedCol(
					x,
					y,
					state.map((l) => (l > 7 ? 1 : 0))
				);
			},
			opts
		);

		m.addEventListener(
			GRID_LED_LEVEL_ROW,
			({ detail: { x, y, state } }) => {
				log('series does not support LED levels, degrading to on/off', 1);
				gridLedRow(
					x,
					y,
					state.map((l) => (l > 7 ? 1 : 0))
				);
			},
			opts
		);

		m.addEventListener(
			GRID_LED_LEVEL_MAP,
			({ detail: { x, y, state } }) => {
				log('series does not support LED levels, degrading to on/off', 1);
				gridLedMap(
					x,
					y,
					state.map((l) => (l > 7 ? 1 : 0))
				);
			},
			opts
		);
	}

	processData(data) {
		let start = 0;
		while (data.byteLength > start + 1) {
			const header = data.getUint8(start++);
			let x;
			let y;
			let datum;
			switch (header) {
				case PROTO_SERIES_BUTTON_DOWN:
					datum = data.getUint8(start++);
					[x, y] = [datum >> 4, datum & 0xf];
					this.m.emit(GRID_KEY_DOWN, { x, y });
					break;
				case PROTO_SERIES_BUTTON_UP:
					datum = data.getUint8(start++);
					[x, y] = [datum >> 4, datum & 0xf];
					this.m.emit(GRID_KEY_UP, { x, y });
					break;
				default:
					break;
			}
		}
	}
}
