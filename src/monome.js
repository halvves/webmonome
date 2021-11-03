import {
  err,
  ERR_WRITE,
  ERR_WRITE_MISSING_BYTES,
  USB_XFER_STATUS_OK,
} from './utils.js';

export default class Monome {
  constructor(device) {
    this.device = device;
    this.callbacks = {};
  }

  async listen() {
    if (!this.isConnected) return;
    const result = await this.read(64);

    if (result.status === 'ok' && result.data.byteLength > 2) {
      this.processData(result.data, 2);
    }

    await this.listen();
  }

  async read(byteLength) {
    if (!this.isConnected) return;
    return this.device.transferIn(1, byteLength);
  }

  async write(data) {
    const buffer = new Uint8Array(data);
    const result = await this.device.transferOut(2, buffer);
    if (result.status !== USB_XFER_STATUS_OK) err(ERR_WRITE);
    if (result.bytesWritten !== buffer.byteLength) err(ERR_WRITE_MISSING_BYTES);
    return result;
  }

  get isConnected() {
    return Boolean(this.device && this.device.opened);
  }

  on(eventName, fn) {
    if (typeof fn !== 'function') return;
    (this.callbacks[eventName] = this.callbacks[eventName] || []).push(fn);
  }

  off(eventName, fn) {
    if (arguments.length === 0) {
      this.callbacks = {};
      return;
    }

    const cbs = this.callbacks[eventName];
    if (!cbs) return;

    if (arguments.length === 1) {
      delete this.callbacks[eventName];
      return;
    }

    for (let i = 0; i < cbs.length; i++) {
      if (cbs[i] === fn) {
        cbs.splice(i, 1);
        break;
      }
    }

    if (cbs.length === 0) {
      delete this.callbacks[eventName];
    }
  }

  emit(name, payload) {
    const cbs = this.callbacks[name];
    if (!Array.isArray(cbs)) return;
    for (let i = 0; i < cbs.length; i++) {
      const fn = cbs[i];
      if (typeof fn !== 'function') skip;
      fn(payload);
    }
  }
}
