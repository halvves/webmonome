const MSG_PREFIX = 'WebMonome: ';
export const ERR_NOT_SUPPORTED = 'device type not yet supported';
export const ERR_WRITE = 'write error';
export const ERR_WRITE_MISSING_BYTES = 'write is missing bytes';
export const WARN_NO_USB = 'this browser does not support WebUsb.';
export const WARN_NOT_CONNECTED =
  'there is no device connected. try calling .connect() first.';

export const USB_XFER_STATUS_OK = 'ok';
export const USB_XFER_STATUS_STALL = 'stall';
export const USB_XFER_STATUS_BABBLE = 'babble';

export const DEVICE_TYPE_MEXT = 0;
export const DEVICE_TYPE_SERIES = 1;

// logging
export const log = (msg, level = 0) =>
  console[['log', 'warn', 'error'][level]](MSG_PREFIX + msg);
export const err = msg => {
  throw new Error(MSG_PREFIX + msg);
};

// device detection
const REGEX_SERIES = /^m(64|128|256)/;
const REGEX_KIT = /^mk/;
const REGEX_MEXT = /^[Mm]\d+/;
export const deviceType = device => {
  if (
    REGEX_SERIES.test(device.serialNumber) ||
    REGEX_KIT.test(device.serialNumber)
  ) {
    return DEVICE_TYPE_SERIES;
  } else if (REGEX_MEXT.test(device.serialNumber)) {
    return DEVICE_TYPE_MEXT;
  } else {
    err(ERR_NOT_SUPPORTED);
  }
};

// interface mapping
export const VENDOR_ID_GENESIS = 0x0403;
export const VENDOR_ID_2021 = 0x0483;

// based on personal observation, unsure if there is a
// a dynamic way to determine these (right now, i just
// know from exp that 2021 devices have to claim interface
// 1 instead of 0)
const interfaceMap = {
  [VENDOR_ID_GENESIS]: 0,
  [VENDOR_ID_2021]: 1,
};

export const getInterfaceForVendor = vendorId => interfaceMap[vendorId] || 0;

// endpoints (get i/o based on chosen interface endpoints)
const getEndpointsForDevice = device => {
  return device.configuration.interfaces[getInterfaceForVendor(device.vendorId)]
    .alternates[0].endpoints;
};

export const getEndpoint = (device, dir) => {
  const defaults = { in: 1, out: 2 };
  let endpoint;
  try {
    const endpoints = getEndpointsForDevice(device);
    endpoint = endpoints.find(({ direction }) => direction === dir);
  } catch (e) {
    log(e, 2);
  }
  return endpoint ? endpoint.endpointNumber : defaults[dir];
};

// math
export const clamp = (val, min, max) => Math.max(Math.min(val, max), min);

// bit ops
export const packLineData = state => {
  let data = 0;
  for (let i = 0; i < Math.min(8, state.length); i++) {
    data = data | (clamp(state[i], 0, 1) << i);
  }
  return data;
};

export const packIntensityData = (state, length) => {
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