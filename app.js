import { initState } from "./src/state.js";
import { bindEvents } from "./src/events.js";
import { normalizeSelection } from "./src/selection.js";
import { render } from "./src/ui.js";

initState();
normalizeSelection();
bindEvents();
render();
