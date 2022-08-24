const WebMonome = (function() {
  /* monome usb vendor id */
  const VENDOR_ID = 0x0403;

  /* errors */
  const MSG_PREFIX = 'WebMonome: ';
  const ERR_WRITE = 'write error';
  const ERR_WRITE_MISSING_BYTES = 'write is missing bytes';
  const WARN_NO_USB = 'this browser does not support WebUsb.';
  const WARN_NOT_CONNECTED =
    'there is no device connected. try calling .connect() first.';
  const err = msg => {
    throw new Error(MSG_PREFIX + msg);
  };
  const log = (msg, level = 0) =>
    console[['log', 'warn', 'error'][level]](MSG_PREFIX + msg);

  /* usb status */
  const USB_XFER_STATUS_OK = 'ok';
  const USB_XFER_STATUS_STALL = 'stall';
  const USB_XFER_STATUS_BABBLE = 'babble';

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

  /* check for support */
  const hasUsb = 'navigator' in window && 'usb' in navigator;

  /* utils */
  const clamp = (val, min, max) => Math.max(Math.min(val, max), min);

  const packHeader = (addr, cmd) => ((addr & 0xf) << 4) | (cmd & 0xf);
  const unpackHeader = header => [header >> 4, header & 0xf];

  const packBuffer = (addr, cmd, data) =>
    new Uint8Array([
      packHeader(addr, cmd),
      ...(Array.isArray(data) ? data : []),
    ]);

  const isConnected = device => Boolean(device && device.opened);

  const write = async (device, addr, cmd, ...data) => {
    if (!isConnected(device)) {
      log(WARN_NOT_CONNECTED, 1);
      return;
    }

    const buffer = packBuffer(addr, cmd, data);
    const result = await device.transferOut(2, buffer);
    if (result.status !== USB_XFER_STATUS_OK) err(ERR_WRITE);
    if (result.bytesWritten !== buffer.byteLength) err(ERR_WRITE_MISSING_BYTES);

    return result;
  };

  const read = async (device, byteLength) => {
    if (!isConnected(device)) return;

    return device.transferIn(1, byteLength);
  };

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

  return function() {
    if (!hasUsb) {
      log(WARN_NO_USB, 1);
      return {};
    }

    let device = null;
    let callbacks = {};

    const emit = (name, payload) => {
      const cbs = callbacks[name];
      if (!Array.isArray(cbs)) return;
      for (let i = 0; i < cbs.length; i++) {
        const fn = cbs[i];
        if (typeof fn !== 'function') skip;
        fn(payload);
      }
    };

    // is this the best way to constanly listen to a usb device?
    const deviceLoop = async () => {
      // TODO: handle other loop breaks
      if (!isConnected(device)) return;

      const result = await read(device, 64);

      if (result.status === 'ok' && result.data.byteLength > 2) {
        const processData = start => {
          const header = result.data.getUint8(start++);
          switch (header) {
            case packHeader(ADDR_SYSTEM, SYS_QUERY_RESPONSE):
              emit('query', {
                type: result.data.getUint8(start++),
                count: result.data.getUint8(start++),
              });
              break;
            case packHeader(ADDR_SYSTEM, SYS_ID):
              let str = '';
              for (let i = 0; i < 32; i++) {
                str += String.fromCharCode(result.data.getUint8(start++));
              }
              emit('getId', str);
              break;
            case packHeader(ADDR_SYSTEM, SYS_GRID_SIZE):
              emit('getGridSize', {
                x: result.data.getUint8(start++),
                y: result.data.getUint8(start++),
              });
              break;
            case packHeader(ADDR_KEY_GRID, CMD_KEY_DOWN):
              emit('gridKeyDown', {
                x: result.data.getUint8(start++),
                y: result.data.getUint8(start++),
              });
              break;
            case packHeader(ADDR_KEY_GRID, CMD_KEY_UP):
              emit('gridKeyUp', {
                x: result.data.getUint8(start++),
                y: result.data.getUint8(start++),
              });
              break;
            default:
              break;
          }

          if (result.data.byteLength > start + 1) {
            processData(start);
          }
        };
        processData(2);
      }
      await deviceLoop();
    };

    const monome = {
      get connected() {
        return isConnected(device);
      },
      connect: async function() {
        try {
          device = await navigator.usb.requestDevice({
            filters: [{ vendorId: VENDOR_ID }],
          });
          await device.open();
          if (device.configuration === null)
            await device.selectConfiguration(1);
          await device.claimInterface(0);
          deviceLoop();
        } catch (e) {
          device = null;
          throw e;
        }
      },
      query: async function() {
        return write(device, ADDR_SYSTEM, SYS_QUERY);
      },
      getId: async function() {
        return write(device, ADDR_SYSTEM, SYS_GET_ID);
      },
      getGridSize: async function() {
        return write(device, ADDR_SYSTEM, SYS_GET_GRID_SIZES);
      },
      gridLed: async function(x, y, on) {
        return write(
          device,
          ADDR_LED_GRID,
          on ? CMD_LED_ON : CMD_LED_OFF,
          x,
          y
        );
      },
      gridLedAll: async function(on) {
        return write(
          device,
          ADDR_LED_GRID,
          on ? CMD_LED_ALL_ON : CMD_LED_ALL_OFF
        );
      },
      gridLedCol: async function(x, y, state) {
        if (!Array.isArray(state)) return;
        return write(
          device,
          ADDR_LED_GRID,
          CMD_LED_COLUMN,
          x,
          y,
          packLineData(state)
        );
      },
      gridLedRow: async function(x, y, state) {
        if (!Array.isArray(state)) return;
        return write(
          device,
          ADDR_LED_GRID,
          CMD_LED_ROW,
          x,
          y,
          packLineData(state)
        );
      },
      gridLedMap: async function(x, y, state) {
        if (!Array.isArray(state)) return;
        const data = [0, 0, 0, 0, 0, 0, 0, 0];
        for (let i = 0; i < Math.min(64, state.length); i++) {
          const byteIndex = Math.floor(i / 8);
          const bitIndex = i % 8;
          data[byteIndex] =
            data[byteIndex] | (clamp(state[i], 0, 1) << bitIndex);
        }
        return write(device, ADDR_LED_GRID, CMD_LED_MAP, x, y, ...data);
      },
      gridLedIntensity: async function(intensity) {
        return write(
          device,
          ADDR_LED_GRID,
          CMD_LED_INTENSITY,
          clamp(intensity, 0, 15)
        );
      },
      gridLedLevel: async function(x, y, level) {
        return write(
          device,
          ADDR_LED_GRID,
          CMD_LED_LEVEL_SET,
          x,
          y,
          clamp(level, 0, 15)
        );
      },
      gridLedLevelAll: async function(level) {
        return write(
          device,
          ADDR_LED_GRID,
          CMD_LED_LEVEL_ALL,
          clamp(level, 0, 15)
        );
      },
      gridLedLevelCol: async function(x, y, state) {
        if (!Array.isArray(state)) return;
        return write(
          device,
          ADDR_LED_GRID,
          CMD_LED_LEVEL_COLUMN,
          x,
          y,
          ...packIntensityData(state, 8)
        );
      },
      gridLedLevelRow: async function(x, y, state) {
        if (!Array.isArray(state)) return;
        return write(
          device,
          ADDR_LED_GRID,
          CMD_LED_LEVEL_ROW,
          x,
          y,
          ...packIntensityData(state, 8)
        );
      },
      gridLedLevelMap: async function(x, y, state) {
        if (!Array.isArray(state)) return;
        return write(
          device,
          ADDR_LED_GRID,
          CMD_LED_LEVEL_MAP,
          x,
          y,
          ...packIntensityData(state, 64)
        );
      },
      on: function(eventName, fn) {
        if (typeof fn !== 'function') return;
        (callbacks[eventName] = callbacks[eventName] || []).push(fn);
      },
      off: function(eventName, fn) {
        if (arguments.length === 0) {
          callbacks = {};
          return;
        }

        const cbs = callbacks[eventName];
        if (!cbs) return;

        if (arguments.length === 1) {
          delete callbacks[eventName];
          return;
        }

        for (let i = 0; i < cbs.length; i++) {
          if (cbs[i] === fn) {
            cbs.splice(i, 1);
            break;
          }
        }

        if (cbs.length === 0) {
          delete callbacks[eventName];
        }
      },
    };

    return monome;
  };
})();

export default WebMonome;
