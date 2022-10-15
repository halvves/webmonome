import GridMext from './GridMext.js';
import GridSeries from './GridSeries.js';
import {
  deviceType,
  DEVICE_TYPE_MEXT,
  DEVICE_TYPE_SERIES,
  log,
  WARN_NO_USB,
} from './utils.js';

/* monome usb vendor id */
const VENDOR_ID_GENESIS = 0x0403;
const VENDOR_ID_2021 = 0x0483;

// based on personal observation, unsure if there is a
// a dynamic way to determine these (right now, i just
// know from exp that 2021 devices have to claim interface
// 1 instead of 0)
const interfaceMap = {
  [VENDOR_ID_GENESIS]: 0,
  [VENDOR_ID_2021]: 1,
};
export const getInterfaceForVendor = vendorId => interfaceMap[vendorId] || 0;

/* check for support */
const hasUsb = 'navigator' in window && 'usb' in navigator;

export default {
  async connect() {
    if (!hasUsb) return log(WARN_NO_USB, 1);

    let device;
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
      const monome = factory(device);
      monome.listen();
      return monome;
    } catch (e) {
      device = null;
      throw e;
    }
  },
};

function factory(device) {
  const Klass = {
    [DEVICE_TYPE_MEXT]: GridMext,
    [DEVICE_TYPE_SERIES]: GridSeries,
  }[deviceType(device)];

  return new Klass(device);
}
