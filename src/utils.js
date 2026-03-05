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

/**
 * @param {unknown} msg - the message to log
 * @param {0 | 1 | 2} [level] - the log level (0 = log, 1 = warn, 2 = error)
 * @example
 * log('this is a log message');
 * log('this is a warning message', 1);
 * log('this is an error message', 2);
 */
export function log(msg, level = 0) {
	console[['log', 'warn', 'error'][level]](MSG_PREFIX + msg);
}

/**
 * @param {string} msg - the error message
 * @returns {never}
 * @example
 * err('this is an error message'); // throws an error with the message
 */
export function err(msg) {
	throw new Error(MSG_PREFIX + msg);
}

/******************
 * DEVICE DETECTION
 ******************/
const REGEX_SERIES = /^m(64|128|256)/;
const REGEX_KIT = /^mk/;
const REGEX_MEXT = /^[Mm]\d+/;

/**
 * determines the type of a device based on its serial number.
 * @param {USBDevice} device
 * @returns {0 | 1} the device type
 */
export const deviceType = (device) => {
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

/*******************
 * INTERFACE MAPPING
 *******************/
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

/**
 * @param {number} vendorId
 */
export const getInterfaceForVendor = (vendorId) => interfaceMap[vendorId] || 0;

// endpoints (get i/o based on chosen interface endpoints)
/**
 * @param {USBDevice} device
 */
const getEndpointsForDevice = (device) => {
	return device.configuration.interfaces[getInterfaceForVendor(device.vendorId)]
		.alternates[0].endpoints;
};

/**
 * @param {USBDevice} device
 * @param {'in' | 'out'} dir
 */
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

/*******************
 * MATH UTILS
 *******************/
/**
 * clamps a value between a minimum and maximum.
 * @param {number} val - the value to clamp
 * @param {number} min - the minimum value
 * @param {number} max - the maximum value
 * @example
 * clamp(5, 0, 10); // returns 5
 * clamp(-5, 0, 10); // returns 0
 * clamp(15, 0, 10); // returns 10
 */
export const clamp = (val, min, max) => Math.max(Math.min(val, max), min);

/*******************
 * BIT OPS
 *******************/
/**
 * packs an array of binary (0/1) values into a single byte.
 * @param {number[]} state - array of 0/1 values (up to 8)
 */
export const packLineData = (state) => {
	let data = 0;
	for (let i = 0; i < Math.min(8, state.length); i++) {
		data = data | (clamp(state[i], 0, 1) << i);
	}
	return data;
};

/**
 * packs an array of intensity values (0-15) into packed nybble data.
 * @param {number[]} state - array of 0-15 values
 * @param {number} length - number of values to pack
 */
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
