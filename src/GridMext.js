import { clamp, packIntensityData, packLineData } from './utils.js';
import { DeviceBase } from './DeviceBase.js';
import {
  GET_GRID_SIZE,
  GET_ID,
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
  QUERY,
  SEND_GET_GRID_SIZE,
  SEND_GET_ID,
  SEND_QUERY,
} from './events.js';

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

const packBuffer = ([addr, cmd, ...data]) => [
  packHeader(addr, cmd),
  ...(Array.isArray(data) ? data : []),
];

export class GridMext extends DeviceBase {
  constructor(device, m) {
    super(device, m);
    this.bindEvents();
  }

  writeBuffer(...args) {
    return this.write(packBuffer(args));
  }

  bindEvents() {
    const m = this.m;
    const opts = { signal: this.abort.signal };

    m.addEventListener(
      SEND_QUERY,
      () => {
        this.writeBuffer(ADDR_SYSTEM, SYS_QUERY);
      },
      opts
    );

    m.addEventListener(
      SEND_GET_ID,
      () => {
        this.writeBuffer(ADDR_SYSTEM, SYS_GET_ID);
      },
      opts
    );

    m.addEventListener(
      SEND_GET_GRID_SIZE,
      () => {
        this.writeBuffer(ADDR_SYSTEM, SYS_GET_GRID_SIZES);
      },
      opts
    );

    m.addEventListener(
      GRID_LED,
      ({ detail: { x, y, on } }) => {
        this.writeBuffer(ADDR_LED_GRID, on ? CMD_LED_ON : CMD_LED_OFF, x, y);
      },
      opts
    );

    m.addEventListener(
      GRID_LED_ALL,
      ({ detail: { on } }) => {
        this.writeBuffer(ADDR_LED_GRID, on ? CMD_LED_ALL_ON : CMD_LED_ALL_OFF);
      },
      opts
    );

    m.addEventListener(
      GRID_LED_COL,
      ({ detail: { x, y, state } }) => {
        this.writeBuffer(
          ADDR_LED_GRID,
          CMD_LED_COLUMN,
          x,
          y,
          packLineData(state)
        );
      },
      opts
    );

    m.addEventListener(
      GRID_LED_ROW,
      ({ detail: { x, y, state } }) => {
        this.writeBuffer(ADDR_LED_GRID, CMD_LED_ROW, x, y, packLineData(state));
      },
      opts
    );

    m.addEventListener(
      GRID_LED_MAP,
      ({ detail: { x, y, state } }) => {
        const data = [0, 0, 0, 0, 0, 0, 0, 0];
        for (let i = 0; i < Math.min(64, state.length); i++) {
          const byteIndex = Math.floor(i / 8);
          const bitIndex = i % 8;
          data[byteIndex] =
            data[byteIndex] | (clamp(state[i], 0, 1) << bitIndex);
        }
        this.writeBuffer(ADDR_LED_GRID, CMD_LED_MAP, x, y, ...data);
      },
      opts
    );

    m.addEventListener(
      GRID_LED_INTENSITY,
      ({ detail: { intensity } }) => {
        this.writeBuffer(
          ADDR_LED_GRID,
          CMD_LED_INTENSITY,
          clamp(intensity, 0, 15)
        );
      },
      opts
    );

    m.addEventListener(
      GRID_LED_LEVEL,
      ({ detail: { x, y, level } }) => {
        this.writeBuffer(
          ADDR_LED_GRID,
          CMD_LED_LEVEL_SET,
          x,
          y,
          clamp(level, 0, 15)
        );
      },
      opts
    );

    m.addEventListener(
      GRID_LED_LEVEL_ALL,
      ({ detail: { level } }) => {
        this.writeBuffer(ADDR_LED_GRID, CMD_LED_LEVEL_ALL, clamp(level, 0, 15));
      },
      opts
    );

    m.addEventListener(
      GRID_LED_LEVEL_COL,
      ({ detail: { x, y, state } }) => {
        this.writeBuffer(
          ADDR_LED_GRID,
          CMD_LED_LEVEL_COLUMN,
          x,
          y,
          ...packIntensityData(state, 8)
        );
      },
      opts
    );

    m.addEventListener(
      GRID_LED_LEVEL_ROW,
      ({ detail: { x, y, state } }) => {
        this.writeBuffer(
          ADDR_LED_GRID,
          CMD_LED_LEVEL_ROW,
          x,
          y,
          ...packIntensityData(state, 8)
        );
      },
      opts
    );

    m.addEventListener(
      GRID_LED_LEVEL_MAP,
      ({ detail: { x, y, state } }) => {
        this.writeBuffer(
          ADDR_LED_GRID,
          CMD_LED_LEVEL_MAP,
          x,
          y,
          ...packIntensityData(state, 64)
        );
      },
      opts
    );
  }

  processData(data) {
    let start = 0;
    while (data.byteLength > start + 1) {
      const header = data.getUint8(start++);
      switch (header) {
        case packHeader(ADDR_SYSTEM, SYS_QUERY_RESPONSE):
          this.m.emit(QUERY, {
            type: data.getUint8(start++),
            count: data.getUint8(start++),
          });
          break;
        case packHeader(ADDR_SYSTEM, SYS_ID):
          let str = '';
          for (let i = 0; i < 32; i++) {
            str += String.fromCharCode(data.getUint8(start++));
          }
          this.m.emit(GET_ID, str);
          break;
        case packHeader(ADDR_SYSTEM, SYS_GRID_SIZE):
          this.m.emit(GET_GRID_SIZE, {
            x: data.getUint8(start++),
            y: data.getUint8(start++),
          });
          break;
        case packHeader(ADDR_KEY_GRID, CMD_KEY_DOWN):
          this.m.emit(GRID_KEY_DOWN, {
            x: data.getUint8(start++),
            y: data.getUint8(start++),
          });
          break;
        case packHeader(ADDR_KEY_GRID, CMD_KEY_UP):
          this.m.emit(GRID_KEY_UP, {
            x: data.getUint8(start++),
            y: data.getUint8(start++),
          });
          break;
        default:
          break;
      }
    }
  }
}
