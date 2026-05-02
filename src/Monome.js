import { GridMext } from './interfaces/GridMext.js';
import { GridSeries } from './interfaces/GridSeries.js';
import { CanvasGrid } from './interfaces/CanvasGrid.js';
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

/**
 * @typedef {Object} MonomeEventMap
 * @property {{x: number, y: number}} gridKeyDown
 * @property {{x: number, y: number}} gridKeyUp
 * @property {{type: number, count: number}} query
 * @property {string} getId
 * @property {{x: number, y: number}} getGridSize
 * @property {{error: Error}} error
 */

const hasUsb =
	typeof window !== 'undefined' && 'navigator' in window && 'usb' in navigator;

class Monome extends EventTarget {
	#abort = new AbortController();
	/** @type {import('./interfaces/DeviceBase.js').DeviceBase | null} */
	#bridge = null;
	/** @type {Set<import('./interfaces/CanvasGrid.js').CanvasGrid>} */
	#canvases = new Set();
	/** @type {Array<{name: string, fn: (detail: any) => void, wrapper: EventListener}>} */
	#listeners = []; // used to track listeners for event sugar
	#size = { x: 16, y: 8 };

	/**
	 * @returns {{x: number, y: number}}
	 */
	get size() {
		return { ...this.#size };
	}

	// wrap addEventListener to apply abort signal for easy cleanup
	/**
	 * @param {string} name
	 * @param {EventListenerOrEventListenerObject} fn
	 * @param {AddEventListenerOptions} [options]
	 */
	addEventListener(name, fn, options = {}) {
		super.addEventListener(name, fn, {
			signal: this.#abort.signal,
			...options,
		});
	}

	// event sugar
	/**
	 * @template {keyof MonomeEventMap} K
	 * @param {K} name
	 * @param {(detail: MonomeEventMap[K]) => void} fn
	 * @returns {this}
	 */
	on(name, fn) {
		/** @param {Event} e */
		const wrapper = (e) => fn(/** @type {CustomEvent} */ (e).detail);
		this.#listeners.push({ name, fn, wrapper });
		this.addEventListener(name, wrapper);
		return this;
	}

	/**
	 * @param {string} [name]
	 * @param {(detail: any) => void} [fn]
	 * @returns {this}
	 */
	off(name, fn) {
		if (!name) {
			// remove all listeners
			this.#listeners.forEach(({ name, wrapper }) => {
				this.removeEventListener(name, wrapper);
			});
			this.#listeners = [];
			return this;
		}

		if (typeof fn === 'undefined') {
			// remove all listeners for this event name
			this.#listeners = this.#listeners.filter((l) => {
				if (l.name === name) {
					this.removeEventListener(name, l.wrapper);
					return false;
				}
				return true;
			});
			return this;
		}

		const idx = this.#listeners.findIndex(
			(l) => l.name === name && l.fn === fn
		);
		if (idx !== -1) {
			const { wrapper } = this.#listeners[idx];
			this.removeEventListener(name, wrapper);
			this.#listeners.splice(idx, 1);
		}
		return this;
	}

	/**
	 * @returns {Promise<void>}
	 * @throws {Error} if the user cancels the device request or if there is an error during connection
	 */
	async connect() {
		if (!hasUsb) {
			log(WARN_NO_USB, 1);
			return;
		}

		/** @type {USBDevice | null} */
		let device = null;
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

			const bridge =
				/** @type {import('./interfaces/DeviceBase.js').DeviceBase} */ (
					this.#bridge
				);
			bridge.listen();

			navigator.usb.addEventListener('disconnect', (e) => {
				if (e.device === device) {
					this.disconnect();
				}
			});
		} catch (e) {
			if (device?.opened) {
				await device.close();
			}
			throw e;
		}
	}

	/**
	 * @returns {Promise<void>}
	 */
	async disconnect() {
		if (this.#bridge) {
			await this.#bridge.dispose();
			this.#bridge = null;
		}
	}

	/**
	 * @param {Omit<import('./interfaces/CanvasGrid.js').CanvasGridConfig, 'onDispose'>} [config]
	 * @returns {import('./interfaces/CanvasGrid.js').CanvasGrid}
	 */
	createCanvasGrid(config = {}) {
		const v = new CanvasGrid(this, {
			...config,
			onDispose: (c) => this.#canvases.delete(c),
		});
		this.#canvases.add(v);
		return v;
	}

	/**
	 * @param {string} eventName
	 * @param {any} [payload]
	 * @returns {CustomEvent}
	 */
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

	/**
	 * @param {number} x
	 * @param {number} y
	 * @param {boolean | number} on
	 */
	gridLed(x, y, on) {
		this.emit(GRID_LED, { x, y, on });
	}

	/**
	 * @param {boolean | number} on
	 */
	gridLedAll(on) {
		this.emit(GRID_LED_ALL, { on });
	}

	/**
	 * @param {number} x
	 * @param {number} y
	 * @param {number[]} state
	 */
	gridLedCol(x, y, state) {
		if (!Array.isArray(state)) return;
		this.emit(GRID_LED_COL, { x, y, state });
	}

	/**
	 * @param {number} x
	 * @param {number} y
	 * @param {number[]} state
	 */
	gridLedRow(x, y, state) {
		if (!Array.isArray(state)) return;
		this.emit(GRID_LED_ROW, { x, y, state });
	}

	/**
	 * @param {number} x
	 * @param {number} y
	 * @param {number[]} state
	 */
	gridLedMap(x, y, state) {
		if (!Array.isArray(state)) return;
		this.emit(GRID_LED_MAP, { x, y, state });
	}

	/**
	 * @param {number} intensity - 0-15
	 */
	gridLedIntensity(intensity) {
		this.emit(GRID_LED_INTENSITY, { intensity });
	}

	/**
	 * @param {number} x
	 * @param {number} y
	 * @param {number} level - 0-15
	 */
	gridLedLevel(x, y, level) {
		this.emit(GRID_LED_LEVEL, { x, y, level });
	}

	/**
	 * @param {number} level - 0-15
	 */
	gridLedLevelAll(level) {
		this.emit(GRID_LED_LEVEL_ALL, { level });
	}

	/**
	 * @param {number} x
	 * @param {number} y
	 * @param {number[]} state - 0-15 values
	 */
	gridLedLevelCol(x, y, state) {
		if (!Array.isArray(state)) return;
		this.emit(GRID_LED_LEVEL_COL, { x, y, state });
	}

	/**
	 * @param {number} x
	 * @param {number} y
	 * @param {number[]} state - 0-15 values
	 */
	gridLedLevelRow(x, y, state) {
		if (!Array.isArray(state)) return;
		this.emit(GRID_LED_LEVEL_ROW, { x, y, state });
	}

	/**
	 * @param {number} x
	 * @param {number} y
	 * @param {number[]} state - 0-15 values
	 */
	gridLedLevelMap(x, y, state) {
		if (!Array.isArray(state)) return;
		this.emit(GRID_LED_LEVEL_MAP, { x, y, state });
	}

	/**
	 * @returns {Promise<void>}
	 */
	async dispose() {
		await this.disconnect();
		this.#canvases.forEach((v) => v.dispose());
		this.#canvases.clear();
		this.off();
		this.#abort.abort();
	}
}

export { Monome };
export default Monome;
