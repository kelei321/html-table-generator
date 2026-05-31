import { showToast, render } from "../ui.js";

export function finish(ok, success, failure) {
  render();
  showToast(ok ? success : failure);
}

export function cellPos(cell) {
  return { row: Number(cell.dataset.row), col: Number(cell.dataset.col) };
}

export function isFormTarget(target) {
  return Boolean(target.closest?.("input, textarea, select"));
}
