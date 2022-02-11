import { clamp, packLineData } from './utils.js';
import Monome from './monome.js';

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

export default class Series extends Monome {
  constructor(device) {
    super(device);
  }

  processData(data, start) {
    const header = data.getUint8(start++);
    let x;
    let y;
    let datum;
    switch (header) {
      case PROTO_SERIES_BUTTON_DOWN:
        datum = data.getUint8(start++);
        [x, y] = [datum >> 4, datum & 0xf];
        this.emit('gridKeyDown', { x, y });
        break;
      case PROTO_SERIES_BUTTON_UP:
        datum = data.getUint8(start++);
        [x, y] = [datum >> 4, datum & 0xf];
        this.emit('gridKeyUp', { x, y });
        break;
      default:
        break;
    }

    if (data.byteLength > start + 1) {
      this.processData(data, start);
    }
  }

  query() {}

  getId() {}

  getGridSize() {
    const sizes = {
      64: { x: 8, y: 8 },
      128: { x: 16, y: 8 },
      256: { x: 16, y: 16 }
    };
    const [_, size] = this.device.serialNumber.match(/^m(64|128|256)/);
    this.emit('getGridSize', sizes[size]);
  }

  gridLed(x, y, on) {
    return this.write([
      on ? PROTO_SERIES_LED_ON : PROTO_SERIES_LED_OFF,
      (x << 4) | y,
    ]);
  }

  gridLedAll(on) {
    return this.write([PROTO_SERIES_CLEAR | (on & 0x01)]);
  }

  gridLedCol(x, y, state) {
    if (!Array.isArray(state)) return;
    /*
      y offset is seemingly ignored in the serial protocol?
      see: https://github.com/monome/libmonome/blob/cd11b2fde61b7ecd1c171cf9f8568918b0199df9/src/proto/series.c#L184
    */
    const mode =
      state.length === 8 ? PROTO_SERIES_LED_COL_8 : PROTO_SERIES_LED_COL_16;

    return this.write([mode | (x & 0x0f), packLineData(state)]);
  }

  gridLedRow(x, y, state) {
    if (!Array.isArray(state)) return;
    /*
      x offset is seemingly ignored in the serial protocol?
      see: https://github.com/monome/libmonome/blob/cd11b2fde61b7ecd1c171cf9f8568918b0199df9/src/proto/series.c#L209
    */
    const mode =
      state.length === 8 ? PROTO_SERIES_LED_ROW_8 : PROTO_SERIES_LED_ROW_16;

    return this.write([mode | (y & 0x0f), packLineData(state)]);
  }

  gridLedMap(x, y, state) { }

  gridLedIntensity(intensity) {
    return this.write([
      PROTO_SERIES_INTENSITY | (clamp(intensity, 0, 15) & 0x0f),
    ]);
  }

  gridLedLevel(x, y, level) {
    return this.gridLed(x, y, level > 7);
  }

  gridLedLevelAll(level) {
    return this.gridLedIntensity(level);
  }

  gridLedLevelCol(x, y, state) {
    return this.gridLedCol(x, y, state.map(level => level > 7));
  }

  gridLedLevelRow(x, y, state) {
    return this.gridLedRow(x, y, state.map(level => level > 7));
  }

  gridLedLevelMap(x, y, state) {}
}
