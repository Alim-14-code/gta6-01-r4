// Neon Harbor — keyboard and mouse input.
// Tracks held keys and mouse position/presses; the game reads this
// state each frame. Prevents the browser from scrolling on game keys.

export function createInput() {
  const keys = new Set();
  const state = {
    keys,
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    clicked: false,
    // True while any of the given key codes is held.
    down(...codes) {
      return codes.some((c) => keys.has(c));
    },
    // Direction helpers for driving and walking.
    get throttle() {
      return (this.down('KeyW', 'ArrowUp') ? 1 : 0) - (this.down('KeyS', 'ArrowDown') ? 1 : 0);
    },
    get steer() {
      return (this.down('KeyD', 'ArrowRight') ? 1 : 0) - (this.down('KeyA', 'ArrowLeft') ? 1 : 0);
    },
    get sprint() {
      return this.down('ShiftLeft', 'ShiftRight');
    },
  };

  const GAME_KEYS = new Set([
    'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft',
    'ArrowRight', 'Space', 'KeyE', 'KeyF', 'KeyM', 'KeyP', 'Escape',
    'ShiftLeft', 'ShiftRight',
  ]);

  function onKeyDown(e) {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    keys.add(e.code);
    if (e.code === 'KeyE' || e.code === 'KeyF' || e.code === 'Space' || e.code === 'Enter') {
      state.pressedAction = true;
    }
  }
  function onKeyUp(e) {
    keys.delete(e.code);
  }
  function onMouseMove(e) {
    state.mouseX = e.clientX;
    state.mouseY = e.clientY;
  }
  function onMouseDown(e) {
    state.mouseDown = true;
    state.clicked = true;
  }
  function onMouseUp() {
    state.mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('blur', () => keys.clear());

  // Call once per frame after the game has read the state.
  state.endFrame = () => {
    state.clicked = false;
    state.pressedAction = false;
  };
  return state;
}
