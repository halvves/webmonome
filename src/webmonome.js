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
  const packHeader = (addr, cmd) => ((addr & 0xf) << 4) | (cmd & 0xf);
  const unpackHeader = header => [header >> 4, header & 0xf];

  const packBuffer = (addr, cmd, data) =>
    new Uint8Array([
      packHeader(addr, cmd),
      ...(Array.isArray(data) ? data : []),
    ]);

  const isConnected = device => device && device.opened;

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

  return function() {
    if (!hasUsb) {
      log(WARN_NO_USB, 1);
      return {};
    }

    let device = null;
    let callbacks = {};

    const handleGridKey = (name, e) => {
      const cbs = callbacks[name];
      if (!Array.isArray(cbs)) return;
      for (let i = 0; i < cbs.length; i++) {
        fn = cbs[i];
        if (typeof fn !== 'function') skip;
        fn(e);
      }
    };

    // is this the best way to constanly listen to a usb device?
    const deviceLoop = async () => {
      // TODO: handle other loop breaks
      if (!device || !device.opened) return;

      const result = await read(device, 64);

      if (result.status === 'ok' && result.data.byteLength > 2) {
        const processData = start => {
          const header = result.data.getUint8(start++);
          switch (header) {
            case packHeader(ADDR_SYSTEM, SYS_QUERY_RESPONSE):
              // TODO: how do we read /sys/query ?
              start = start + 5;
              break;
            case packHeader(ADDR_SYSTEM, SYS_ID):
              // TODO: how do we read /sys/id ?
              start = start + 32;
              break;
            case packHeader(ADDR_SYSTEM, SYS_GRID_SIZE):
              // TODO: how do we read /sys/id ?
              console.log(header);
              start = start + 2;
              break;
            case packHeader(ADDR_KEY_GRID, CMD_KEY_DOWN):
              handleGridKey('gridKeyDown', {
                x: result.data.getUint8(start++),
                y: result.data.getUint8(start++),
              });
              break;
            case packHeader(ADDR_KEY_GRID, CMD_KEY_UP):
              handleGridKey('gridKeyUp', {
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
        return Boolean(device && device.opened);
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
      /*
      TODO: implement remaining LED commands
      gridLedCol: async function(on) {

      },
      gridLedRow: async function(on) {

      },
      gridLedFrame: async function() {

      },
      gridLedIntensity: async function() {

      },
      gridLedLevel: async function() {

      },
      gridLedLevelAll: async function() {

      },
      gridLedLevelCol: async function() {

      },
      gridLedLevelRow: async function() {

      },
      gridLedLevelFrame: async function() {

      },
      */
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
