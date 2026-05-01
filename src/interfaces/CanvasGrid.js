import {
	GET_GRID_SIZE,
	GRID_KEY_DOWN,
	GRID_KEY_UP,
	GRID_LED,
	GRID_LED_ALL,
	GRID_LED_COL,
	GRID_LED_MAP,
	GRID_LED_ROW,
	GRID_LED_LEVEL,
	GRID_LED_LEVEL_ALL,
	GRID_LED_LEVEL_COL,
	GRID_LED_LEVEL_ROW,
	GRID_LED_LEVEL_MAP,
} from '../events.js';

const MOUSE = 'mouse';

/**
 * @param {boolean | number} value
 */
function valueToLevel(value) {
	if (typeof value === 'boolean') {
		return value ? 15 : 0;
	}

	return Math.max(0, Math.min(15, value));
}

/**
 * @typedef {Object} CanvasGridConfig
 * @property {number} [width]
 * @property {number} [height]
 * @property {string} [activeColor]
 * @property {string} [inactiveColor]
 * @property {string} [borderColor]
 * @property {(canvas: CanvasGrid) => void} [onDispose]
 */

export class CanvasGrid {
	canvas;
	#abort = new AbortController();
	/** @type {import('../Monome.js').Monome | null} */
	#m;
	/** @type {(canvas: CanvasGrid) => void} */
	#onDispose;
	/** @type {CanvasRenderingContext2D | null} */
	#ctx;
	/** @type {Map<string, number>} */
	#cache = new Map();
	/** @type {ResizeObserver | undefined} */
	#resizeObserver;

	#gridWidth = 16;
	#gridHeight = 8;

	#activeColor = '#003dda';
	#inactiveColor = '#fff';
	#borderColor = '#000';

	/** @type {Map<string | number, {x: number, y: number} | null>} */
	#contacts = new Map();
	/** @type {Map<string, number>} */
	#contactsPerKey = new Map();
	/** @type {DOMRect | null} */
	#rect = null;
	#squareSize = 0;

	/**
	 * @param {import('../Monome.js').Monome} m
	 * @param {CanvasGridConfig} config
	 */
	constructor(
		m,
		{ width, height, activeColor, inactiveColor, borderColor, onDispose }
	) {
		this.#m = m;
		this.#onDispose = onDispose ?? (() => {});
		this.#gridWidth = width || this.#gridWidth;
		this.#gridHeight = height || this.#gridHeight;
		this.#activeColor = activeColor || this.#activeColor;
		this.#inactiveColor = inactiveColor || this.#inactiveColor;
		this.#borderColor = borderColor || this.#borderColor;

		this.canvas = document.createElement('canvas');
		this.canvas.style.touchAction = 'none';
		this.canvas.style.userSelect = 'none';
		this.#ctx = this.canvas.getContext('2d');
		this.#ctx.lineWidth = 0;

		this.#bindCanvasEvents();
		this.#bindMonomeEvents();
		this.#updateDimensions(this.#gridWidth, this.#gridHeight);

		this.#resizeObserver = new ResizeObserver(() => {
			this.#updateDimensions(this.#gridWidth, this.#gridHeight);
			this.#redrawFromCache();
			this.#rect = null;
		});
		this.#resizeObserver.observe(this.canvas);
	}

	#square(x, y, value) {
		if (x >= this.#gridWidth || y >= this.#gridHeight) return;

		const level = valueToLevel(value);
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

		this.#cache.set(`${x}_${y}`, level);
		if (level === 0) {
			this.#ctx.fillStyle = this.#inactiveColor;
			this.#ctx.fill();
		} else if (level === 15) {
			this.#ctx.fillStyle = this.#activeColor;
			this.#ctx.fill();
		} else {
			this.#ctx.fillStyle = this.#inactiveColor;
			this.#ctx.fill();
			this.#ctx.globalAlpha = level / 15;
			this.#ctx.fillStyle = this.#activeColor;
			this.#ctx.fill();
			this.#ctx.globalAlpha = 1;
		}

		this.#ctx.strokeStyle = this.#borderColor;
		this.#ctx.stroke();
	}

	#row(x, y, state, isLevel = false) {
		const offsetX = Math.floor(x / 8) * 8;
		for (let i = 0; i < 8; i++) {
			this.#square(offsetX + i, y, isLevel ? state[i] : Boolean(state[i]));
		}
	}

	#col(x, y, state, isLevel = false) {
		const offsetY = Math.floor(y / 8) * 8;
		for (let i = 0; i < 8; i++) {
			this.#square(x, offsetY + i, isLevel ? state[i] : Boolean(state[i]));
		}
	}

	#map(x, y, state, isLevel = false) {
		const isArray = Array.isArray(state);
		const offsetX = Math.floor(x / 8) * 8;
		const offsetY = Math.floor(y / 8) * 8;
		for (let i = 0; i < 64; i++) {
			const mx = (i % 8) + offsetX;
			const my = Math.floor(i / 8) + offsetY;
			const val = isArray ? state[i] : state;
			this.#square(mx, my, isLevel ? val : Boolean(val));
		}
	}

	#all(value, isLevel = false) {
		let heightOffset = 0;
		while (heightOffset < this.#gridHeight) {
			let widthOffset = 0;
			while (widthOffset < this.#gridWidth) {
				this.#map(widthOffset, heightOffset, value, isLevel);
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
				this.#square(x, y, this.#cache.get(`${x}_${y}`) ?? 0);
			}
		}
	}

	#refreshGeometry() {
		this.#rect = this.canvas.getBoundingClientRect();
		const scale = window.devicePixelRatio;
		const sw = this.canvas.width / scale / this.#gridWidth;
		const sh = this.canvas.height / scale / this.#gridHeight;
		this.#squareSize = Math.min(sw, sh);
	}

	#getSquareFromClient(cx, cy) {
		if (!this.#rect) this.#refreshGeometry();
		const x = Math.floor((cx - this.#rect.left) / this.#squareSize);
		const y = Math.floor((cy - this.#rect.top) / this.#squareSize);
		if (x < 0 || y < 0 || x >= this.#gridWidth || y >= this.#gridHeight) {
			return null;
		}
		return { x, y };
	}

	#enterKey(pos) {
		const key = `${pos.x}_${pos.y}`;
		const count = (this.#contactsPerKey.get(key) ?? 0) + 1;
		this.#contactsPerKey.set(key, count);
		// adding more contacts doesn't re emit (modeling physical btns)
		if (count === 1) this.#m.emit(GRID_KEY_DOWN, pos);
	}

	#leaveKey(pos) {
		const key = `${pos.x}_${pos.y}`;
		const count = (this.#contactsPerKey.get(key) ?? 0) - 1;
		// only emit key up when all contacts have left the pad (again modeling physical btns)
		if (count <= 0) {
			this.#contactsPerKey.delete(key);
			this.#m.emit(GRID_KEY_UP, pos);
		} else {
			this.#contactsPerKey.set(key, count);
		}
	}

	#startContact(id, cx, cy) {
		if (this.#contacts.has(id)) this.#endContact(id);
		const pos = this.#getSquareFromClient(cx, cy);
		this.#contacts.set(id, pos);
		if (pos) this.#enterKey(pos);
	}

	#updateContact(id, cx, cy) {
		if (!this.#contacts.has(id)) return;
		const old = this.#contacts.get(id);
		const updated = this.#getSquareFromClient(cx, cy);
		if (old && updated && old.x === updated.x && old.y === updated.y) return;
		if (!old && !updated) return;
		if (old) this.#leaveKey(old);
		if (updated) this.#enterKey(updated);
		this.#contacts.set(id, updated);
	}

	#endContact(id) {
		if (!this.#contacts.has(id)) return;
		const old = this.#contacts.get(id);
		if (old) this.#leaveKey(old);
		this.#contacts.delete(id);
	}

	#bindCanvasEvents() {
		const opts = { signal: this.#abort.signal, passive: true };

		const handleMouseDown = (e) => {
			this.#refreshGeometry();
			this.#startContact(MOUSE, e.clientX, e.clientY);
		};

		const handleMouseMove = (e) => {
			this.#updateContact(MOUSE, e.clientX, e.clientY);
		};

		const handleMouseUp = () => {
			this.#endContact(MOUSE);
		};

		// release key on mouseleave but keep mouse contact in the map (as null)
		// so re-entering the canvas while still pressed resumes drag-draw
		const handleMouseLeave = () => {
			if (!this.#contacts.has(MOUSE)) return;
			const old = this.#contacts.get(MOUSE);
			if (old) this.#leaveKey(old);
			this.#contacts.set(MOUSE, null);
		};

		const handleTouchStart = (e) => {
			this.#refreshGeometry();
			for (const t of e.changedTouches) {
				this.#startContact(t.identifier, t.clientX, t.clientY);
			}
		};

		const handleTouchMove = (e) => {
			for (const t of e.changedTouches) {
				this.#updateContact(t.identifier, t.clientX, t.clientY);
			}
		};

		const handleTouchEnd = (e) => {
			for (const t of e.changedTouches) {
				this.#endContact(t.identifier);
			}
		};

		this.canvas.addEventListener('mousedown', handleMouseDown, opts);
		this.canvas.addEventListener('mousemove', handleMouseMove, opts);
		this.canvas.addEventListener('mouseleave', handleMouseLeave, opts);
		window.addEventListener('mouseup', handleMouseUp, opts);

		this.canvas.addEventListener('touchstart', handleTouchStart, opts);
		this.canvas.addEventListener('touchmove', handleTouchMove, opts);
		this.canvas.addEventListener('touchend', handleTouchEnd, opts);
		this.canvas.addEventListener('touchcancel', handleTouchEnd, opts);
	}

	#bindMonomeEvents() {
		const m = this.#m;
		const opts = { signal: this.#abort.signal };
		/** @type {(name: string, fn: (e: CustomEvent) => void) => void} */
		const listen = (name, fn) => m.addEventListener(name, fn, opts);

		listen(GRID_LED, ({ detail: { x, y, on } }) => {
			this.#square(x, y, on);
		});

		listen(GRID_LED_ALL, ({ detail: { on } }) => {
			this.#all(on);
		});

		listen(GRID_LED_COL, ({ detail: { x, y, state } }) => {
			this.#col(x, y, state);
		});

		listen(GRID_LED_ROW, ({ detail: { x, y, state } }) => {
			this.#row(x, y, state);
		});

		listen(GRID_LED_MAP, ({ detail: { x, y, state } }) => {
			this.#map(x, y, state);
		});

		listen(GRID_LED_LEVEL, ({ detail: { x, y, level } }) => {
			this.#square(x, y, level);
		});

		listen(GRID_LED_LEVEL_ALL, ({ detail: { level } }) => {
			this.#all(level, true);
		});

		listen(GRID_LED_LEVEL_COL, ({ detail: { x, y, state } }) => {
			this.#col(x, y, state, true);
		});

		listen(GRID_LED_LEVEL_ROW, ({ detail: { x, y, state } }) => {
			this.#row(x, y, state, true);
		});

		listen(GRID_LED_LEVEL_MAP, ({ detail: { x, y, state } }) => {
			this.#map(x, y, state, true);
		});

		listen(GET_GRID_SIZE, ({ detail: { x, y } }) => {
			this.#updateDimensions(x, y);
			this.#redrawFromCache();
			this.#rect = null;
		});
	}

	/**
	 * @param {{ activeColor?: string, inactiveColor?: string, borderColor?: string }} theme
	 */
	updateTheme({ activeColor, inactiveColor, borderColor }) {
		if (activeColor) this.#activeColor = activeColor;
		if (inactiveColor) this.#inactiveColor = inactiveColor;
		if (borderColor) this.#borderColor = borderColor;
		this.#redrawFromCache();
	}

	dispose() {
		this.#abort.abort();
		this.#resizeObserver.disconnect();

		if (this.canvas.parentNode) {
			this.canvas.parentNode.removeChild(this.canvas);
		}

		this.#onDispose(this);
		this.#m = null;
		this.#cache.clear();
		this.#contactsPerKey.clear();
		this.#contacts.clear();
	}
}
