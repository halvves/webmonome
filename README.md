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

const btn = document.createElement('button');
btn.innerHTML = 'connect';
btn.addEventListener('click', () => {
  monome.connect();
});
document.body.appendChild(btn);

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

const btn = document.createElement('button');
btn.innerHTML = 'connect';
btn.addEventListener('click', () => {
  monome.connect();
});
document.body.appendChild(btn);

const keydown = e => {
  monome.gridLed(e.x, e.y, true);
};

const keyup = e => {
  monome.gridLed(e.x, e.y);
};

monome.on('gridKeyDown', keydown);
monome.on('gridKeyUp', keyup);
```

## requirements

`webmonome` relies on the `WebUSB` api. information on browser support for the `WebUSB` api can be found over at [caniuse](https://caniuse.com/#feat=webusb).

`webmonome` also requires that **serialosc is disabled**. On **macOS** open Terminal and execute:

```
launchctl unload /Library/LaunchAgents/org.monome.serialosc.plist
 ```

To re-enable:

```
launchctl load /Library/LaunchAgents/org.monome.serialosc.plist
```

## api

`webmonome` is currently very bare bones (as i'm still working out the kinks with WebUSB and the monome serial protocol), but there is enough there to perform most grid operations.

### connect

- initialize WebUSB and connect to device:

  ```javascript
  monome.connect()
  ```

### system

system responses come in the form of events (see below), but this may be changed to include a callback or promise for ergonomics.

- request device information:

  ```javascript
  monome.query()
  ```

- request device id:

  ```javascript
  monome.getId()
  ```

- request grid size:

  ```javascript
  monome.getGridSize()
  ```

### grid ops

- set a single LED on or off:

  ```javascript
  monome.gridLed(xCoord, yCoord, on)
  ```
  - `xCoord`: integer
  - `yCoord`: integer
  - `on`: boolean


- set all LEDs on or off:

  ```javascript
  monome.gridLedAll(on)
  ```
  - `on`: boolean


- set on/off state for column of LEDs:

  ```javascript
  monome.gridLedCol(xOffset, yOffset, state)
  ```
  - `xOffset`: integer
  - `yOffset`: integer (floored to multiples of 8 by the device firmware)
  - `state`: array of up to 8 0/1 bits


- set on/off state for row of LEDs:

  ```javascript
  monome.gridLedRow(xOffset, yOffset, state)
  ```
  - `xOffset`: integer (floored to multiples of 8 by the device firmware)
  - `yOffset`: integer
  - `state`: array of up to 8 0/1 bits


- set on/off state for an 8x8 quad of LEDs:

  ```javascript
  monome.gridLedMap(xOffset, yOffset, state)
  ```
  `xOffset`: integer
  `yOffset`: integer
  `state`: array of up to 64 0/1 bits

- set system wide grid intensity:

  ```javascript
  monome.gridLedIntensity(intensity)
  ```
  - `intensity`: integer (0-15)


- set single LED to specific level:

  ```javascript
  monome.gridLedLevel(xCoord, yCoord, level)
  ```
  - `xCoord`: integer
  - `yCoord`: integer
  - `level`: integer (0-15)


- set all LEDs to specific level:

  ```javascript
  monome.gridLedLevelAll(level)
  ```
  - `level`: integer (0-15)


- set level state for column of LEDs:

  ```javascript
  monome.gridLedLevelCol(num: xOffset, num: yOffset, []num: state)
  ```
  - `xOffset`: integer
  - `yOffset`: integer (floored to multiples of 8 by the device firmware)
  - `state`: array of up to 8 integers (0-15)


- set level state for row of LEDs:

  ```javascript
  monome.gridLedLevelRow(num: xOffset, num: yOffset, []num: state)
  ```
  - `xOffset`: integer (floored to multiples of 8 by the device firmware)
  - `yOffset`: integer
  - `state`: array of up to 8 integers (0-15)


- set level state for an 8x8 quad of LEDs:

  ```javascript
  monome.gridLedLevelMap(num: xOffset, num: yOffset, []num: state)
  ```
  - `xOffset`: integer
  - `yOffset`: integer
  - `state`: array of up to 64 integers (0-15)


### event system

- subscribe to events:

  ```javascript
  monome.on(eventName, callback)
  ```
  - `eventName`: string
  - `callback`: function


- unsubscribe from events:

  ```javascript
  monome.off(eventName, callback)
  ```
  - `eventName`: string
  - `callback`: function

### events

  - `query` `{type: num, count: num}`
  - `getId` `str`
  - `getGridSize` `{x: num, y: num}`
  - `gridKeyDown` `{x: num, y: num}`
  - `gridKeyUp` `{x: num, y: num}`


## next steps

* remaining /sys/ commands
  - grid offsets
  - addr scan
  - firmware version
* arc ops
* add any additional ops in the monome serial protocol (reaching something similar to libmonome)

## see also
* [monome protocol](https://monome.org/docs/serialosc/serial.txt)
* [libmonome](https://github.com/monome/libmonome)
* [serialosc](https://github.com/monome/serialosc)

[npm-badge]: https://img.shields.io/npm/v/webmonome/alpha
[npm-badge-url]: https://www.npmjs.com/package/webmonome/v/alpha
[deps-badge]: https://img.shields.io/librariesio/release/npm/webmonome/0.0.1-alpha.4
[deps-badge-url]: https://libraries.io/npm/webmonome
[size-badge]: https://img.shields.io/bundlephobia/minzip/webmonome/0.0.1-alpha.4
[size-badge-url]: https://bundlephobia.com/result?p=webmonome@0.0.1-alpha.4
[license-badge]: https://img.shields.io/github/license/halvves/webmonome
[license-badge-url]: ./LICENSE
