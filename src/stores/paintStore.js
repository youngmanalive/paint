import { observable, action } from 'mobx';

import { compress, decompress } from 'utils/stringPress';

class PaintStore {
  canvas;
  ctx;
  lastX;
  lastY;
  hue = 0;
  isInitialized = false;
  strokeHistory = [];
  session = [];
  redos = [];

  @observable
  isDrawing = false;

  @observable
  color = 'black';

  @observable
  size = 6;

  @action
  setColor = color => {
    this.color = color;
  };

  @action
  setSize = size => {
    this.size = size;
  };

  initialize = canvas => {
    if (!this.isInitialized && canvas) {
      this.canvas = canvas;
      this.canvas.width = canvas.clientWidth;
      this.canvas.height = canvas.clientHeight;
      this.boundingClientRect = canvas.getBoundingClientRect();
      this.ctx = canvas.getContext('2d');
      this.ctx.lineJoin = 'round';
      this.ctx.lineCap = 'round';
      this.isInitialized = true;
    }
  };

  stroke = ({ color, size, lastX, lastY, clientX, clientY }) => {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = size;
    this.ctx.beginPath();
    this.ctx.moveTo(lastX, lastY);
    this.ctx.lineTo(clientX, clientY);
    this.ctx.stroke();
  };

  draw = (event, firstContact = false) => {
    let touch;
    if (event.touches && event.touches.length) {
      touch = event.touches.item(0);
    }
    if (!this.isDrawing) return;
    const { left, top } = this.boundingClientRect;

    const color = !this.color ? `hsl(${this.hue++}, 100%, 50%)` : this.color;
    const size = this.size;
    const clientX = (touch ? touch.clientX : event.clientX) - left;
    const clientY = (touch ? touch.clientY : event.clientY) - top;
    const lastX = firstContact ? clientX : this.lastX;
    const lastY = firstContact ? clientY : this.lastY;

    const strokeData = { color, size, lastX, lastY, clientX, clientY };

    this.stroke(strokeData);
    this.session.push(strokeData);

    this.lastX = clientX;
    this.lastY = clientY;
  };

  redraw = (stack = this.strokeHistory) => {
    this.clear();
    stack.forEach(entry => {
      entry.forEach(this.stroke);
    });
  };

  start = event => {
    this.isDrawing = true;
    if (this.redos.length) {
      this.redos = [];
    }
    this.draw(event, true);
  };

  stop = () => {
    if (this.isDrawing) {
      this.isDrawing = false;
      this.strokeHistory.push(this.session);
      this.session = [];
    }
  };

  undo = () => {
    this.redos.push(this.strokeHistory.pop());
    this.redraw();
  };

  redo = () => {
    if (this.redos.length) {
      this.strokeHistory.push(this.redos.pop());
      this.redraw();
    }
  };

  clear = () => {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  };

  reset = () => {
    this.strokeHistory = [];
    this.session = [];
    this.redos = [];
    this.clear();
  };

  save = () => {
    const history = this.strokeHistory.reduce(
      (history, entry) =>
        history.concat(
          entry.map(step => [
            step.lastX,
            step.lastY,
            step.clientX,
            step.clientY,
            step.color,
            step.size
          ])
        ),
      []
    );

    const compressed = compress(JSON.stringify(history));

    localStorage.setItem('saved', compressed);
  };

  load = () => {
    const saved = localStorage.getItem('saved');
    if (!saved) return;

    try {
      const parsed = JSON.parse(decompress(saved)).map(entry => {
        const [lastX, lastY, clientX, clientY, color, size] = entry;
        return { lastX, lastY, clientX, clientY, color, size };
      });
      this.reset();
      this.strokeHistory.push(parsed);
      this.redraw();
    } catch (e) {}
  };
}

export default PaintStore;
