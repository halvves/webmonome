import {
	log,
	err,
	ERR_WRITE,
	ERR_WRITE_MISSING_BYTES,
	USB_XFER_STATUS_OK,
	getEndpoint,
	ERR_WRITE_NO_DEVICE,
} from '../utils.js';
import { ERROR } from '../events.js';

export class DeviceBase {
	abort = new AbortController();
	/** @type {USBDevice | null} */
	device;
	/** @type {import('../Monome.js').Monome} */
	m;
	/** @type {number} */
	endpointIn;
	/** @type {number} */
	endpointOut;

	/**
	 * @param {USBDevice} device
	 * @param {import('../Monome.js').Monome} m
	 */
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
				const device = /** @type {USBDevice} */ (this.device);
				const result = await device.transferIn(this.endpointIn, 64);
				if (result.status === USB_XFER_STATUS_OK) {
					if (result.data && result.data.byteLength > 0) {
						this.processData(result.data);
					}
				} else {
					log('transferIn status not ok: ' + result.status, 1);
				}
			} catch (e) {
				if (!this.isConnected) return;
				const message = e instanceof Error ? e.message : String(e);
				log('listen error: ' + message, 2);
				this.m.emit(ERROR, { error: e });
				return;
			}
		}
	}

	/**
	 * @param {number[]} data
	 */
	async write(data) {
		if (!this.device) err(ERR_WRITE_NO_DEVICE);
		const buffer = new Uint8Array(data);
		const result = await this.device.transferOut(this.endpointOut, buffer);
		if (result.status !== USB_XFER_STATUS_OK) err(ERR_WRITE);
		if (result.bytesWritten !== buffer.byteLength) err(ERR_WRITE_MISSING_BYTES);
		return result;
	}

	/**
	 * @param {DataView} data
	 */
	// eslint-disable-next-line no-unused-vars
	processData(data) {
		log('processData not implemented for this device', 1);
	}

	async dispose() {
		this.abort.abort();
		if (this.device && this.device.opened) {
			await this.device.close();
		}
		this.device = null;
	}
}
