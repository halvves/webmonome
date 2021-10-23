import { clamp } from './utils.js';
import Monome from './monome.js';

/* input from series device */
const PROTO_SERIES_BUTTON_DOWN = 0x00;
const PROTO_SERIES_BUTTON_UP = 0x10;
const PROTO_SERIES_TILT = 0xD0;
const PROTO_SERIES_AUX_INPUT = 0xE0;

/* output from series device  */
const PROTO_SERIES_LED_ON = 0x20;
const PROTO_SERIES_LED_OFF = 0x30;
const PROTO_SERIES_LED_ROW_8 = 0x40;
const PROTO_SERIES_LED_COL_8 = 0x50;
const PROTO_SERIES_LED_ROW_16 = 0x60;
const PROTO_SERIES_LED_COL_16 = 0x70;
const PROTO_SERIES_LED_FRAME = 0x80;
const PROTO_SERIES_CLEAR = 0x90;
const PROTO_SERIES_INTENSITY = 0xA0;
const PROTO_SERIES_MODE = 0xB0;
const PROTO_SERIES_AUX_PORT_ACTIVATE = 0xC0;
const PROTO_SERIES_AUX_PORT_DEACTIVATE = 0xD0;

export default class Series extends Monome {
  constructor (device) {
    super(device);
  }

  processData (data, start) {
    const header = data.getUint8(start++);
    let x;
    let y;
    switch (header) {
    case PROTO_SERIES_BUTTON_DOWN:
      [x, y] = [data.getUint8(3) >> 4, data.getUint8(3) & 0xf];
      this.emit('gridKeyDown', { x, y });
      break;
    case PROTO_SERIES_BUTTON_UP:
      [x, y] = [data.getUint8(3) >> 4, data.getUint8(3) & 0xf];
      this.emit('gridKeyUp', { x, y });
      break;
    default:
      break;
    }

    if (data.byteLength > start + 1) {
      this.processData(data, start);
    }
  }

  async gridLed (x, y, on) {
    return this.write([
      PROTO_SERIES_LED_ON + ((on ? 0 : 1) << 4),
      (x << 4) | y
    ]);
  }

  async gridLedAll (on) {
    return this.write([PROTO_SERIES_CLEAR | ((on ? 1 : 0) & 0x01)]);
  }

  async gridLedIntensity (intensity) {
    return this.write([
      PROTO_SERIES_INTENSITY | (clamp(intensity, 0, 15) & 0x0F)
    ]);
  }
}
