const GridUI = (monome) => {
    const { emit } = monome;
    const canvas = document.createElement('canvas');
    let initialized = false;
    let gridWidth = 0;
    let gridHeight = 0;
  
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 0;
  
    const square = (x, y, on) => {
      // early return if out of grid range
      if (x >= gridWidth || y >= gridHeight) return;
  
      // get dimensions
      const squareWidth = canvas.width / gridWidth;
      const squareHeight = canvas.height / gridHeight;
      const minSquareDimension = Math.min(squareWidth, squareHeight);
      const spacing = (minSquareDimension / 8);
      const radius = (minSquareDimension / 8);
      ctx.lineWidth = (minSquareDimension / 16);
    
      // get points
      const x1 = x * minSquareDimension + spacing;
      const x2 = (x + 1) * minSquareDimension - spacing;
      const y1 = y * minSquareDimension + spacing;
      const y2 = (y + 1) * minSquareDimension - spacing;
  
      // canvas path ops
      ctx.beginPath();
      ctx.moveTo(x1 + radius, y1);
      ctx.arcTo(x2, y1, x2, y2, radius);
      ctx.arcTo(x2, y2, x1, y2, radius);
      ctx.arcTo(x1, y2, x1, y1, radius);
      ctx.arcTo(x1, y1, x2, y1, radius);
      ctx.closePath();
  
      // canvas draw ops
      if (on) {
        ctx.fillStyle = '#003dda';
      } else {
        ctx.fillStyle = '#fff';
      }
      ctx.fill();
      ctx.stroke();
    };
  
    const row = (x, y, state) => {
      const offsetX = Math.floor(x / 8) * 8;
      for (let i = 0; i < 8; i++) {
        square(offsetX + i, y, state[i]);
      }
    };
  
    const col = (x, y, state) => {
      const offsetY = Math.floor(y / 8) * 8;
      for (let i = 0; i < 8; i++) {
        square(x, offsetY + i, state[i]);
      }
    };
  
    const map = (x, y, state) => {
      const isArray = Array.isArray(state);
      const offsetX = Math.floor(x / 8) * 8;
      const offsetY = Math.floor(y / 8) * 8;
      for (let i = 0; i < 64; i++) {
        const x = (i % 8) + offsetX;
        const y = Math.floor(i / 8) + offsetY;
        square(x, y, isArray ? state[i] : !!state);
      }
    };
  
    const all = on => {
      let heightOffset = 0;
      while (heightOffset < gridHeight) {
        let widthOffset = 0;
        while (widthOffset < gridWidth) {
          map(widthOffset, heightOffset, on);
          widthOffset += 8;
        }
        heightOffset += 8;
      }
    };
  
    const updateDimensions = (x, y) => {
      const scale = window.devicePixelRatio;
      const rect = canvas.getBoundingClientRect();
      gridWidth = x;
      gridHeight = y;
      canvas.height = rect.height * scale;
      canvas.width = rect.width * scale;
      if (!initialized) {
        initialized = true;
        all();
      }
    };
  
    const getSquareFromEvent = e => {
      const rect = canvas.getBoundingClientRect();
  
      const squareWidth = rect.width / gridWidth;
      const squareHeight = rect.height / gridHeight;
      const minSquareDimension = Math.min(squareWidth, squareHeight);
  
      const x = Math.floor((e.offsetX / minSquareDimension));
      const y = Math.floor((e.offsetY / minSquareDimension));
  
      if (x >= gridWidth || y >= gridHeight) return;
  
      return {
        x, y
      };
    };

    let pressed = false;
    let prev = {};
    canvas.addEventListener('mousedown', e => {
      pressed = true;
      const pos = getSquareFromEvent(e);
      if (pos) emit('gridKeyDown', pos);
      prev = {};
    });

    canvas.addEventListener('mouseup', e => {
      pressed = false;
      const pos = getSquareFromEvent(e);
      if (pos) emit('gridKeyUp', pos);
      prev = {};
    });

    window.addEventListener('mouseup', () => {
      pressed = false;
    });

    canvas.addEventListener('mouseleave', e => {
      if (prev) emit('gridKeyUp', prev);
      prev = {};
    });

    canvas.addEventListener('mousemove', e => {
      if (pressed) {
        const pos = getSquareFromEvent(e);
        if (prev && (prev.x !== (pos && pos.x) || prev.y !== (pos && pos.y))) {
          emit('gridKeyUp', prev);
        }
        if (pos) emit('gridKeyDown', pos);
        prev = pos;
      }
    });
  
    return {
      d: canvas,
      s: square,
      c: col,
      r: row,
      m: map,
      a: all,
      u: updateDimensions,
      g: getSquareFromEvent,
    };
  };