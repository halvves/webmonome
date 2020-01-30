# WebMonome

|   |   |
|---|---|
| npm | [0.0.1-alpha.2](https://www.npmjs.com/package/webmonome/v/alpha) |
| size | [1.06kb minzipped](https://bundlephobia.com/result?p=webmonome@0.0.1-alpha.2) |
| dependencies | [zero](./package.json) |
| license | [MIT](./LICENSE) |

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

## api

`webmonome` is currently very bare bones (as i'm still working out the kinks with WebUSB and the monome serial protocol), but there is enough there to capture grid presses and turn LEDs on and off.

- initialize WebUSB and connect to device:

  `monome.connect()`

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