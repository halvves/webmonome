# WebMonome

|   |   |
|---|---|
| npm | [0.0.1](https://www.npmjs.com/package/webmonome) |
| size | [5.4kb minzipped](./scripts/sizecheck.js) |
| dependencies | [zero](./package.json) |
| license | [MIT](./LICENSE) |

*communicate with devices beyond a translator*

`webmonome` is a little library designed to enable communication with monome devices directly from the web browser (bypassing `serialosc`). while `serialosc` is the best choice 99% of the time, i thought that it might be nice to enable the creation of monome apps that required zero install/config.

## usage

### script include

```html
<script src="https://unpkg.com/webmonome"></script>
```
```js
const monome = new Monome();

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

`npm install webmonome`

```javascript
import Monome from 'webmonome';

const monome = new Monome();

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

to re-enable:

```
launchctl load /Library/LaunchAgents/org.monome.serialosc.plist
```

## api

### connect

- initialize WebUSB and connect to device:

  ```javascript
  monome.connect()
  ```

- close the active device connection (safe to call when not connected):

  ```javascript
  monome.disconnect()
  ```

- tear down the instance entirely (disconnects, removes listeners, disposes any canvases):

  ```javascript
  monome.dispose()
  ```

- read the most recently reported grid size (defaults to `{x: 16, y: 8}` until the device reports back):

  ```javascript
  monome.size // { x: number, y: number }
  ```

### system

system responses come in the form of events (see below).

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
  monome.gridLedLevelCol(xOffset, yOffset, state)
  ```
  - `xOffset`: integer
  - `yOffset`: integer (floored to multiples of 8 by the device firmware)
  - `state`: array of up to 8 integers (0-15)


- set level state for row of LEDs:

  ```javascript
  monome.gridLedLevelRow(xOffset, yOffset, state)
  ```
  - `xOffset`: integer (floored to multiples of 8 by the device firmware)
  - `yOffset`: integer
  - `state`: array of up to 8 integers (0-15)


- set level state for an 8x8 quad of LEDs:

  ```javascript
  monome.gridLedLevelMap(xOffset, yOffset, state)
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
  - `error` `{error: Error}`

### canvas grid

`webmonome` can spawn an HTMLCanvas based grid renderer that mirrors hardware state and emits the same `gridKeyDown` / `gridKeyUp` events, so apps can be developed and played without needing a physical device. when a physical device _IS_ connected, the canvas and the hardware stay in sync automatically.

- create a canvas grid (all config is optional, the default values are what is shown in the example):

  ```javascript
  const grid = monome.createCanvasGrid({
    width: 16,
    height: 8,
    activeColor: '#003dda',
    inactiveColor: '#fff',
    borderColor: '#000',
  });
  document.body.appendChild(grid.canvas);
  ```

  the canvas is a regular `HTMLCanvasElement` — size it with css. mouse and multi-touch input both produce `gridKeyDown` / `gridKeyUp` events on the parent `Monome` instance.

- update colors at runtime:

  ```javascript
  grid.updateTheme({ activeColor, inactiveColor, borderColor });
  ```

- remove the canvas and stop listening:

  ```javascript
  grid.dispose();
  ```

## roadmap

things on the list for future releases:

* remaining `/sys/` commands (grid offsets, addr scan, firmware version)
* arc support
* parity with the rest of the monome serial protocol (reaching something similar to libmonome)

## see also
* [monome protocol](https://monome.org/docs/serialosc/serial.txt)
* [libmonome](https://github.com/monome/libmonome)
* [serialosc](https://github.com/monome/serialosc)