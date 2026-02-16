import {
  GET_GRID_SIZE,
  GRID_KEY_DOWN,
  GRID_KEY_UP,
  GRID_LED,
  GRID_LED_ALL,
  GRID_LED_COL,
  GRID_LED_MAP,
  GRID_LED_ROW,
} from './events.js';

export class CanvasGrid {
  #m;
  #ctx;
  #cache = new Set();
  #gridWidth;
  #gridHeight;
  #pressed = false;
  #prev = {};
  #abort = new AbortController();
  #resizeObserver;

  canvas;

  constructor(width, height, m) {
    this.#m = m;
    this.#gridWidth = width;
    this.#gridHeight = height;

    this.canvas = document.createElement('canvas');
    this.#ctx = this.canvas.getContext('2d');
    this.#ctx.strokeStyle = '#000';
    this.#ctx.lineWidth = 0;

    this.#bindCanvasEvents();
    this.#bindMonomeEvents();
    this.#updateDimensions(width, height);

    this.#resizeObserver = new ResizeObserver(() => {
      this.#updateDimensions(this.#gridWidth, this.#gridHeight);
      this.#redrawFromCache();
    });
    this.#resizeObserver.observe(this.canvas);
  }

  #square(x, y, on) {
    if (x >= this.#gridWidth || y >= this.#gridHeight) return;

    const squareWidth = this.canvas.width / this.#gridWidth;
    const squareHeight = this.canvas.height / this.#gridHeight;
    const minDim = Math.min(squareWidth, squareHeight);
    const spacing = minDim / 8;
    const radius = minDim / 8;
    this.#ctx.lineWidth = minDim / 16;

    const x1 = x * minDim + spacing;
    const x2 = (x + 1) * minDim - spacing;
    const y1 = y * minDim + spacing;
    const y2 = (y + 1) * minDim - spacing;

    this.#ctx.beginPath();
    this.#ctx.moveTo(x1 + radius, y1);
    this.#ctx.arcTo(x2, y1, x2, y2, radius);
    this.#ctx.arcTo(x2, y2, x1, y2, radius);
    this.#ctx.arcTo(x1, y2, x1, y1, radius);
    this.#ctx.arcTo(x1, y1, x2, y1, radius);
    this.#ctx.closePath();

    const cacheId = `${x}_${y}`;
    if (on) {
      this.#cache.add(cacheId);
      this.#ctx.fillStyle = '#003dda';
    } else {
      this.#cache.delete(cacheId);
      this.#ctx.fillStyle = '#fff';
    }
    this.#ctx.fill();
    this.#ctx.stroke();
  }

  #row(x, y, state) {
    const offsetX = Math.floor(x / 8) * 8;
    for (let i = 0; i < 8; i++) {
      this.#square(offsetX + i, y, state[i]);
    }
  }

  #col(x, y, state) {
    const offsetY = Math.floor(y / 8) * 8;
    for (let i = 0; i < 8; i++) {
      this.#square(x, offsetY + i, state[i]);
    }
  }

  #map(x, y, state) {
    const isArray = Array.isArray(state);
    const offsetX = Math.floor(x / 8) * 8;
    const offsetY = Math.floor(y / 8) * 8;
    for (let i = 0; i < 64; i++) {
      const mx = (i % 8) + offsetX;
      const my = Math.floor(i / 8) + offsetY;
      this.#square(mx, my, isArray ? state[i] : !!state);
    }
  }

  #all(on) {
    let heightOffset = 0;
    while (heightOffset < this.#gridHeight) {
      let widthOffset = 0;
      while (widthOffset < this.#gridWidth) {
        this.#map(widthOffset, heightOffset, on);
        widthOffset += 8;
      }
      heightOffset += 8;
    }
  }

  #updateDimensions(x, y) {
    const scale = window.devicePixelRatio;
    const rect = this.canvas.getBoundingClientRect();
    this.#gridWidth = x;
    this.#gridHeight = y;
    // only scale if the canvas is already in the DOM
    if (rect.width > 0 && rect.height > 0) {
      this.canvas.height = rect.height * scale;
      this.canvas.width = rect.width * scale;
    }
  }

  #redrawFromCache() {
    for (let x = 0; x < this.#gridWidth; x++) {
      for (let y = 0; y < this.#gridHeight; y++) {
        this.#square(x, y, this.#cache.has(`${x}_${y}`));
      }
    }
  }

  #bindCanvasEvents() {
    const emit = (name, payload) => this.#m.emit(name, payload);
    const opts = { signal: this.#abort.signal };

    function getSquareFromEvent(e) {
      const scale = window.devicePixelRatio;
      const squareWidth = this.canvas.width / scale / this.#gridWidth;
      const squareHeight = this.canvas.height / scale / this.#gridHeight;
      const minDim = Math.min(squareWidth, squareHeight);

      let x = -1;
      let y = -1;

      if (e.type.startsWith('mouse')) {
        x = Math.floor(e.offsetX / minDim);
        y = Math.floor(e.offsetY / minDim);
      } else if (e.type.startsWith('touch')) {
        const rect = this.canvas.getBoundingClientRect();
        x = Math.floor((e.touches[0].clientX - rect.left) / minDim);
        y = Math.floor((e.touches[0].clientY - rect.top) / minDim);
      }

      if (x < 0 || y < 0 || x >= this.#gridWidth || y >= this.#gridHeight)
        return;

      return { x, y };
    }

    function releaseLastKey() {
      if (
        this.#prev &&
        this.#prev.x !== undefined &&
        this.#prev.y !== undefined
      ) {
        emit(GRID_KEY_UP, this.#prev);
      }
      this.#prev = {};
    }

    function handlePointerDown(e) {
      e.preventDefault();
      this.#pressed = true;
      const p = getSquareFromEvent.bind(this)(e);
      if (p) this.#m.emit(GRID_KEY_DOWN, p);
      this.#prev = p || {};
    }

    function handlePointerUp(e) {
      e.preventDefault();
      this.#pressed = false;
      releaseLastKey.bind(this)();
    }

    function handlePointerMove(e) {
      e.preventDefault();
      if (this.#pressed) {
        const pos = getSquareFromEvent.bind(this)(e);
        if (!pos) {
          releaseLastKey.bind(this)();
          return;
        }

        if (pos.x === this.#prev.x && pos.y === this.#prev.y) return;

        if (this.#prev.x !== undefined && this.#prev.y !== undefined) {
          emit(GRID_KEY_UP, this.#prev);
        }
        emit(GRID_KEY_DOWN, pos);
        this.#prev = pos;
      }
    }

    this.canvas.addEventListener(
      'mousedown',
      handlePointerDown.bind(this),
      opts
    );

    this.canvas.addEventListener(
      'mouseup',
      handlePointerUp.bind(this),
      opts
    );

    // finally set pressed to false on mouseup anywhere on window
    window.addEventListener(
      'mouseup',
      () => {
        this.#pressed = false;
      },
      opts
    );

    // release last key on mouse leave BUT keep pressed state until
    // mouseup in case user comes back into canvas
    this.canvas.addEventListener(
      'mouseleave',
      (e) => {
        e.preventDefault();
        releaseLastKey.bind(this)();
      },
      opts
    );

    this.canvas.addEventListener(
      'mousemove',
      handlePointerMove.bind(this),
      opts
    );

    this.canvas.addEventListener(
      'touchstart',
      handlePointerDown.bind(this),
      opts
    );

    this.canvas.addEventListener(
      'touchend',
      handlePointerUp.bind(this),
      opts
    );

    this.canvas.addEventListener(
      'touchcancel',
      handlePointerUp.bind(this),
      opts
    );

    this.canvas.addEventListener(
      'touchmove',
      handlePointerMove.bind(this),
      opts
    );
  }

  // TODO: still needs implementation for level events
  #bindMonomeEvents() {
    const m = this.#m;
    const opts = { signal: this.#abort.signal };

    m.addEventListener(
      GRID_LED,
      ({ detail: { x, y, on } }) => {
        this.#square(x, y, on);
      },
      opts
    );

    m.addEventListener(
      GRID_LED_ALL,
      ({ detail: { on } }) => {
        this.#all(on);
      },
      opts
    );

    m.addEventListener(
      GRID_LED_COL,
      ({ detail: { x, y, state } }) => {
        this.#col(x, y, state);
      },
      opts
    );

    m.addEventListener(
      GRID_LED_ROW,
      ({ detail: { x, y, state } }) => {
        this.#row(x, y, state);
      },
      opts
    );

    m.addEventListener(
      GRID_LED_MAP,
      ({ detail: { x, y, state } }) => {
        this.#map(x, y, state);
      },
      opts
    );

    m.addEventListener(
      GET_GRID_SIZE,
      ({ detail: { x, y } }) => {
        this.#updateDimensions(x, y);
        this.#redrawFromCache();
      },
      opts
    );
  }

  dispose() {
    this.#abort.abort();
    this.#resizeObserver.disconnect();

    if (this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }

    this.#m.__removeCanvas(this);
    this.#m = null;
    this.#cache.clear();
  }
}
