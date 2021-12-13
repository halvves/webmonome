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

export function clamp(val, min, max) {
  return Math.max(Math.min(val, max), min);
}

export function packLineData(state) {
  let data = 0;
  for (let i = 0; i < Math.min(8, state.length); i++) {
    data = data | (clamp(state[i], 0, 1) << i);
  }
  return data;
}

export function err(msg) {
  throw new Error(MSG_PREFIX + msg);
}
export function log(msg, level = 0) {
  console[['log', 'warn', 'error'][level]](MSG_PREFIX + msg);
}
