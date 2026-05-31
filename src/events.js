import { bindActionEvents } from "./events/actions.js";
import { bindClipboardEvents } from "./events/clipboard.js";
import { bindControlEvents } from "./events/controls.js";
import { bindKeyboardEvents } from "./events/keyboard.js";
import { bindTablePointerEvents } from "./events/table-pointer.js";

export function bindEvents() {
  bindActionEvents();
  bindClipboardEvents();
  bindControlEvents();
  bindKeyboardEvents();
  bindTablePointerEvents();
}
