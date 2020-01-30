# WebMonome

[![Latest NPM release][npm-badge]][npm-badge-url]
[![Dependencies][deps-badge]][deps-badge-url]
[![Minzip Size][size-badge]][size-badge-url]
[![License][license-badge]][license-badge-url]

*communicate with devices beyond a translator*

`webmonome` is a little library designed to enable communication with monome devices directly from the web browser (bypassing `serialosc`). while `serialosc` is the best choice 99% of the time, i thought that it might be nice to enable the creation of monome apps that required zero install/config.

## usage

### script include

```html
<script src="https://unpkg.com/webmonome@alpha"></script>
```
```js
const monome = new WebMonome();

const keydown = e => {
  monome.gridLed(e.x, e.y, true);
};

const keyup = e => {
  monome.gridLed(e.x, e.y);
};

monome.on('gridKeyDown', keydown);
monome.on('gridKeyUp', keyup);
```

### import

`npm install webmonome@alpha`

```javascript
import WebMonome from 'webmonome';

const monome = new WebMonome();

const keydown = e => {
  monome.gridLed(e.x, e.y, true);
};

const keyup = e => {
  monome.gridLed(e.x, e.y);
};

monome.on('gridKeyDown', keydown);
monome.on('gridKeyUp', keyup);
```

## api

`webmonome` is currently very bare bones (as i'm still working out the kinks with WebUsb and the monome serial protocol), but there is enough there to capture grid presses and turn LEDs on and off.

- set a single LED on or off:

  `monome.gridLed(num: xCoord, Num: yCoord, boolean: on)`

- set all LEDs on or off:

  `monome.gridLedAll(boolean: on)`

- subscribe to grid key events:

  `monome.on(string: eventName, function: callback)`

- unsubscribe from grid key events:

  `monome.off(string: eventName, function: callback)`

### events

  - `gridKeyDown` `{x: num, y: num}`
  - `gridKeyUp` `{x: num, y: num}`


## next steps

* figure out the /sys/ commands
* add remaining grid ops
* add arc ops
* add any additional ops in the monome serial protocol (reaching something similar functionality to libmonome)

## see also

* [libmonome](https://github.com/monome/libmonome)
* [serialosc](https://github.com/monome/serialosc)

[npm-badge]: https://img.shields.io/npm/v/webmonome/alpha
[npm-badge-url]: https://www.npmjs.com/package/webmonome/v/alpha
[deps-badge]: https://img.shields.io/david/halvves/webmonome
[deps-badge-url]: https://david-dm.org/halvves/webmonome
[size-badge]: https://img.shields.io/bundlephobia/minzip/webmonome/0.0.1-alpha.2
[size-badge-url]: https://bundlephobia.com/result?p=webmonome@0.0.1-alpha.2
[license-badge]: https://img.shields.io/github/license/halvves/webmonome
[license-badge-url]: ./LICENSE