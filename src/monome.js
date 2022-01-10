import {
  log,
  err,
  ERR_WRITE,
  ERR_WRITE_MISSING_BYTES,
  USB_XFER_STATUS_OK,
} from './utils.js';

import { getInterfaceForVendor } from './webmonome.js';

export default class Monome {
  constructor(device) {
    this.device = device;
    this.callbacks = {};

    // set i/o based on chosen interface endpoints
    // TODO: cleanup :'(
    try {
      this.device.configuration.interfaces[
        getInterfaceForVendor(device.vendorId)
      ].alternates[0].endpoints.forEach(({ direction, endpointNumber }) => {
        if (direction === 'in' && this.endpointIn === undefined) {
          this.endpointIn = endpointNumber;
        } else if (direction === 'out' && this.endpointOut === undefined) {
          this.endpointOut = endpointNumber;
        }
      });
    } catch (e) {
      log(e, 2);
    }

    // if unabled to dynmically set, we can try semi-sensible defaults
    this.endpointIn = this.endpointIn === undefined ? 1 : this.endpointIn;
    this.endpointOut = this.endpointOut === undefined ? 2 : this.endpointOut;
  }

  async listen() {
    if (!this.isConnected) return;
    const result = await this.read(64);

    // TODO: did i have a reason for skipping the first two bytes here?
    // seems older mext send noisey bytes that i was skipping. 2021 devices
    // run "silent" and skipping bytes breaks everything
    // not skipping seems to still work fine for older mext
    if (result.status === 'ok' && result.data.byteLength > 0) {
      this.processData(result.data, 0);
    }

    await this.listen();
  }

  async read(byteLength) {
    if (!this.isConnected) return;
    return this.device.transferIn(this.endpointIn, byteLength);
  }

  async write(data) {
    const buffer = new Uint8Array(data);
    const result = await this.device.transferOut(this.endpointOut, buffer);
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
