import Monome from './monome.js';

/* sections */
const ADDR_SYSTEM = 0x0;
const ADDR_LED_GRID = 0x1;
const ADDR_KEY_GRID = 0x2;

/* sys out */
const SYS_QUERY = 0x0;
const SYS_GET_ID = 0x1;
const SYS_SET_ID = 0x2;
const SYS_GET_GRID_OFFSETS = 0x3;
const SYS_SET_GRID_OFFSET = 0x4;
const SYS_GET_GRID_SIZES = 0x5;
const SYS_SET_GRID_SIZE = 0x6;
const SYS_GET_ADDR = 0x7;
const SYS_SET_ADDR = 0x8;
const SYS_GET_VERSION = 0xf;

/* sys in */
const SYS_QUERY_RESPONSE = 0x0;
const SYS_ID = 0x1;
const SYS_GRID_OFFSET = 0x2;
const SYS_GRID_SIZE = 0x3;
const SYS_ADDR = 0x4;
const SYS_VERSION = 0xf;

/* grid out */
const CMD_LED_OFF = 0x0;
const CMD_LED_ON = 0x1;
const CMD_LED_ALL_OFF = 0x2;
const CMD_LED_ALL_ON = 0x3;
const CMD_LED_MAP = 0x4;
const CMD_LED_ROW = 0x5;
const CMD_LED_COLUMN = 0x6;
const CMD_LED_INTENSITY = 0x7;
const CMD_LED_LEVEL_SET = 0x8;
const CMD_LED_LEVEL_ALL = 0x9;
const CMD_LED_LEVEL_MAP = 0xa;
const CMD_LED_LEVEL_ROW = 0xb;
const CMD_LED_LEVEL_COLUMN = 0xc;

/* grid in */
const CMD_KEY_UP = 0x0;
const CMD_KEY_DOWN = 0x1;

const packHeader = (addr, cmd) => ((addr & 0xf) << 4) | (cmd & 0xf);
const unpackHeader = header => [header >> 4, header & 0xf];

const packBuffer = (addr, cmd, data) =>
  new Uint8Array([
    packHeader(addr, cmd),
    ...(Array.isArray(data) ? data : []),
  ]);

const packLineData = state => {
  let data = 0;
  for (let i = 0; i < Math.min(8, state.length); i++) {
    data = data | (clamp(state[i], 0, 1) << i);
  }
  return data;
};

const packIntensityData = (state, length) => {
  const data = [];
  for (let i = 0; i < Math.ceil(length / 2); i++) {
    data[i] = 0;
  }
  for (let i = 0; i < Math.min(length, state.length); i++) {
    const byteIndex = Math.floor(i / 2);
    const nybbleIndex = i % 2;
    const nybbleOffset = nybbleIndex === 0 ? 4 : 0;
    if (typeof data[byteIndex] !== 'number') {
      data[byteIndex] = 0;
    }
    data[byteIndex] =
      data[byteIndex] | (clamp(state[i], 0, 15) << nybbleOffset);
  }
  return data;
};

export default class Mext extends Monome {
  constructor (device) {
    super(device);
  }

  processData (data, start) {
    const header = data.getUint8(start++);
    switch (header) {
    case packHeader(ADDR_SYSTEM, SYS_QUERY_RESPONSE):
      emit('query', {
        type: data.getUint8(start++),
        count: data.getUint8(start++)
      });
      break;
    case packHeader(ADDR_SYSTEM, SYS_ID):
      let str = '';
      for (let i = 0; i < 32; i++) {
        str += String.fromCharCode(data.getUint8(start++));
      }
      emit('getId', str);
      break;
    case packHeader(ADDR_SYSTEM, SYS_GRID_SIZE):
      emit('getGridSize', {
        x: data.getUint8(start++),
        y: data.getUint8(start++)
      });
      break;
    case packHeader(ADDR_SYSTEM, SYS_GRID_SIZE):
      emit('gridKeyDown', {
        x: data.getUint8(start++),
        y: data.getUint8(start++)
      });
      break;
    case packHeader(ADDR_KEY_GRID, CMD_KEY_UP):
      emit('gridKeyUp', {
        x: data.getUint8(start++),
        y: data.getUint8(start++)
      });
      break;
    default:
      break;
    }

    if (data.byteLength > start + 1) {
      this.processData(data, start);
    }
  }

  async query () {
    return this.writeBuffer(ADDR_SYSTEM, SYS_QUERY);
  }

  async getId () {
    return this.writeBuffer(ADDR_SYSTEM, SYS_GET_ID);
  }

  async getGridSize () {
    return this.writeBuffer(ADDR_SYSTEM, SYS_GET_GRID_SIZES);
  }

  async gridLed (x, y, on) {
    return this.writeBuffer(
      ADDR_LED_GRID,
      on ? CMD_LED_ON : CMD_LED_OFF,
      x,
      y
    );
  }

  async gridLedAll (on) {
    return this.writeBuffer(
      ADDR_LED_GRID,
      on ? CMD_LED_ALL_ON : CMD_LED_ALL_OFF
    );
  }

  async gridLedCol (x, y, state) {
    if (!Array.isArray(state)) return;
    return this.writeBuffer(
      ADDR_LED_GRID,
      CMD_LED_COLUMN,
      x,
      y,
      packLineData(state)
    );
  }

  async gridLedRow (x, y, state) {
    if (!Array.isArray(state)) return;
    return this.writeBuffer(
      ADDR_LED_GRID,
      CMD_LED_ROW,
      x,
      y,
      packLineData(state)
    );
  }

  async gridLedMap (x, y, state) {
    if (!Array.isArray(state)) return;
    const data = [0, 0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < Math.min(64, state.length); i++) {
      const byteIndex = Math.floor(i / 8);
      const bitIndex = i % 8;
      data[byteIndex] =
        data[byteIndex] | (clamp(state[i], 0, 1) << bitIndex)
    }
    return this.writeBuffer(ADDR_LED_GRID, CMD_LED_MAP, x, y, ...data);
  }

  async gridLedIntensity (intensity) {
    return this.writeBuffer(
      ADDR_LED_GRID,
      CMD_LED_INTENSITY,
      clamp(intensity, 0, 15)
    );
  }

  async gridLedLevel (x, y, level) {
    return this.writeBuffer(
      ADDR_LED_GRID,
      CMD_LED_LEVEL_SET,
      x,
      y,
      clamp(level, 0, 15)
    );
  }

  async gridLedLevelAll (level) {
    return this.writeBuffer(
      ADDR_LED_GRID,
      CMD_LED_LEVEL_ALL,
      clamp(level, 0, 15)
    );
  }

  async gridLedLevelCol (x, y, state) {
    if (!Array.isArray(state)) return;
    return this.writeBuffer(
      ADDR_LED_GRID,
      CMD_LED_LEVEL_COLUMN,
      x,
      y,
      ...packIntensityData(state, 8)
    );
  }

  async gridLedLevelRow (x, y, state) {
    if (!Array.isArray(state)) return;
    return this.writeBuffer(
      ADDR_LED_GRID,
      CMD_LED_LEVEL_ROW,
      x,
      y,
      ...packIntensityData(state, 8)
    );
  }

  async gridLedLevelMap (x, y, state) {
    if (!Array.isArray(state)) return;
    return this.writeBuffer(
      ADDR_LED_GRID,
      CMD_LED_LEVEL_MAP,
      x,
      y,
      ...packIntensityData(state, 64)
    );
  }

  writeBuffer () {
    return this.writeBuffer(Array.from(arguments));
  }
}
