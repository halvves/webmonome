import { GridMext } from './GridMext.js';
import { GridSeries } from './GridSeries.js';
import { CanvasGrid } from './CanvasGrid.js';
import {
  deviceType,
  DEVICE_TYPE_MEXT,
  DEVICE_TYPE_SERIES,
  getInterfaceForVendor,
  log,
  VENDOR_ID_GENESIS,
  VENDOR_ID_2021,
  WARN_NO_USB,
  WARN_NOT_CONNECTED,
} from './utils.js';
import {
  GET_GRID_SIZE,
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
} from './events.js';

const hasUsb =
  typeof window !== 'undefined' && 'navigator' in window && 'usb' in navigator;

class Monome extends EventTarget {
  #bridge = null;
  #canvases = new Set();
  #size = { x: 16, y: 8 };
  #abort = new AbortController();
  #listeners = []; // used to track listeners for event sugar

  constructor() {
    super();
  }

  get size() {
    return { ...this.#size };
  }

  // overload addEventListener to apply abort signal for easy cleanup
  addEventListener(name, fn, options = {}) {
    super.addEventListener(name, fn, {
      signal: this.#abort.signal,
      ...options,
    });
  }

  // event sugar
  on(name, fn) {
    const wrapper = e => fn(e.detail);
    this.#listeners.push({ name, fn, wrapper });
    this.addEventListener(name, wrapper);
    return this;
  }

  off(name, fn) {
    if (arguments.length === 0) {
      // remove all listeners
      this.#listeners.forEach(({ name, wrapper }) => {
        this.removeEventListener(name, wrapper);
      });
      this.#listeners = [];
      return this;
    }

    if (typeof fn === 'undefined') {
      // remove all listeners for this event name
      this.#listeners = this.#listeners.filter(l => {
        if (l.name === name) {
          this.removeEventListener(name, l.wrapper);
          return false;
        }
        return true;
      });
      return this;
    }

    const idx = this.#listeners.findIndex(l => l.name === name && l.fn === fn);
    if (idx !== -1) {
      const { wrapper } = this.#listeners[idx];
      this.removeEventListener(name, wrapper);
      this.#listeners.splice(idx, 1);
    }
    return this;
  }

  async connect() {
    if (!hasUsb) {
      log(WARN_NO_USB, 1);
      return;
    }

    let device;
    try {
      device = await navigator.usb.requestDevice({
        filters: [
          { vendorId: VENDOR_ID_GENESIS },
          { vendorId: VENDOR_ID_2021 },
        ],
      });
      await device.open();
      if (device.configuration === null) await device.selectConfiguration(1);
      await device.claimInterface(getInterfaceForVendor(device.vendorId));

      const type = deviceType(device);
      if (type === DEVICE_TYPE_MEXT) {
        this.#bridge = new GridMext(device, this);
      } else if (type === DEVICE_TYPE_SERIES) {
        this.#bridge = new GridSeries(device, this);
      }

      this.#bridge.listen();
    } catch (e) {
      device = null;
      throw e;
    }
  }

  async disconnect() {
    if (this.#bridge) {
      await this.#bridge.dispose();
      this.#bridge = null;
    }
  }

  createCanvasGrid({ width = 16, height = 8 } = {}) {
    const v = new CanvasGrid(width, height, this);
    this.#canvases.add(v);
    return v;
  }

  /** @internal — called by CanvasGrid.dispose() */
  __removeCanvas(v) {
    this.#canvases.delete(v);
  }

  emit(eventName, payload) {
    if (!this.#bridge && this.#canvases.size === 0) {
      log(WARN_NOT_CONNECTED, 1);
    }

    const event = new CustomEvent(eventName, { detail: payload });
    this.dispatchEvent(event);

    // store grid size when reported by hardware
    if (eventName === GET_GRID_SIZE && payload) {
      this.#size = { x: payload.x, y: payload.y };
    }

    return event;
  }

  query() {
    this.emit(SEND_QUERY);
  }

  getId() {
    this.emit(SEND_GET_ID);
  }

  getGridSize() {
    this.emit(SEND_GET_GRID_SIZE);
  }

  gridLed(x, y, on) {
    this.emit(GRID_LED, { x, y, on });
  }

  gridLedAll(on) {
    this.emit(GRID_LED_ALL, { on });
  }

  gridLedCol(x, y, state) {
    if (!Array.isArray(state)) return;
    this.emit(GRID_LED_COL, { x, y, state });
  }

  gridLedRow(x, y, state) {
    if (!Array.isArray(state)) return;
    this.emit(GRID_LED_ROW, { x, y, state });
  }

  gridLedMap(x, y, state) {
    if (!Array.isArray(state)) return;
    this.emit(GRID_LED_MAP, { x, y, state });
  }

  gridLedIntensity(intensity) {
    this.emit(GRID_LED_INTENSITY, { intensity });
  }

  gridLedLevel(x, y, level) {
    this.emit(GRID_LED_LEVEL, { x, y, level });
  }

  gridLedLevelAll(level) {
    this.emit(GRID_LED_LEVEL_ALL, { level });
  }

  gridLedLevelCol(x, y, state) {
    if (!Array.isArray(state)) return;
    this.emit(GRID_LED_LEVEL_COL, { x, y, state });
  }

  gridLedLevelRow(x, y, state) {
    if (!Array.isArray(state)) return;
    this.emit(GRID_LED_LEVEL_ROW, { x, y, state });
  }

  gridLedLevelMap(x, y, state) {
    if (!Array.isArray(state)) return;
    this.emit(GRID_LED_LEVEL_MAP, { x, y, state });
  }

  async dispose() {
    await this.disconnect();
    this.#canvases.forEach(v => v.dispose());
    this.#canvases.clear();
    this.off();
    this.#abort.abort();
  }
}

export { Monome };
export default Monome;
