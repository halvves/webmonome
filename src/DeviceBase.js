import {
  log,
  err,
  ERR_WRITE,
  ERR_WRITE_MISSING_BYTES,
  USB_XFER_STATUS_OK,
  getEndpoint,
} from './utils.js';
import { ERROR } from './events.js';

export class DeviceBase {
  abort = new AbortController();

  constructor(device, m) {
    this.device = device;
    this.m = m;
    this.endpointIn = getEndpoint(device, 'in');
    this.endpointOut = getEndpoint(device, 'out');
  }

  get isConnected() {
    return Boolean(this.device && this.device.opened);
  }

  async listen() {
    while (this.isConnected) {
      try {
        const result = await this.device.transferIn(this.endpointIn, 64);
        if (result.status === USB_XFER_STATUS_OK) {
          if (result.data.byteLength > 0) this.processData(result.data);
        } else {
          log('transferIn status not ok: ' + result.status, 1);
        }
      } catch (e) {
        if (!this.isConnected) return;
        log('listen error: ' + e.message, 2);
        this.m.emit(ERROR, { error: e });
        return;
      }
    }
  }

  async write(data) {
    const buffer = new Uint8Array(data);
    const result = await this.device.transferOut(this.endpointOut, buffer);
    if (result.status !== USB_XFER_STATUS_OK) err(ERR_WRITE);
    if (result.bytesWritten !== buffer.byteLength) err(ERR_WRITE_MISSING_BYTES);
    return result;
  }

  processData() {
    log('processData not implemented for this device', 1);
  }

  async dispose() {
    this.abort.abort();
    if (this.device) {
      await this.device.close();
      this.device = null;
    }
  }
}
