import Mext from './mext.js';
import Series from './series.js';
import { err, ERR_NOT_SUPPORTED } from './utils.js';

/* monome usb vendor id */
const VENDOR_ID = 0x0403;

export default async function connect () {
  let device;
  try {
    device = await navigator.usb.requestDevice({
      filters: [{ vendorId: VENDOR_ID }]
    });
    await device.open();
    if (device.configuration === null) await device.selectConfiguration(1);
    await device.claimInterface(0);
    const monome = factory(device);
    monome.listen();
    return monome;
  } catch (e) {
    device = null;
    throw e;
  }
}

function factory (device) {
  const Klass = {
    mext: Mext,
    series: Series
  }[deviceType(device)];

  return new Klass(device);
};

function deviceType (device) {
  if (
    /^m(64|128|256)/.test(device.serialNumber) ||
    /^mk/.test(device.serialNumber)
  ) {
    return 'series';
  } else if (/^[Mm]\d+/.test(device.serialNumber)) {
    return 'mext';
  } else {
    err(ERR_NOT_SUPPORTED);
  }
}
