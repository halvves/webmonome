import {
  log,
  err,
  ERR_WRITE,
  ERR_WRITE_MISSING_BYTES,
  USB_XFER_STATUS_OK,
} from './utils.js';

import { getInterfaceForVendor } from './webmonome.js';

export default class Monome extends EventTarget {
  constructor(device) {
    super();
    this.device = device;
    this.callbacks = {};

    // set i/o based on chosen interface endpoints
    this.endpointIn = getEndpoint(device, 'in');
    this.endpointOut = getEndpoint(device, 'out');
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

  emit(eventName, payload) {
    const event = new CustomEvent(eventName, { detail: payload })
    this.dispatchEvent(event);
    return event;
  }
}

const getEndpointsForDevice = (device) => {
  return device.configuration.interfaces[
    getInterfaceForVendor(device.vendorId)
  ].alternates[0].endpoints;
};

const getEndpoint = (device, dir) => {
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
