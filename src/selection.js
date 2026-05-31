import { appState } from "./state.js";
import { getCell } from "./table-model.js";

export function samePos(a, b) {
  return a?.row === b?.row && a?.col === b?.col;
}

export function visibleSelectedCells() {
  return appState.selection.cells.filter((pos) => {
    const cell = getCell(pos);
    return cell && !cell.hidden;
  });
}

export function normalizeSelection(cells = appState.selection.cells, anchor = cells[0] || appState.selection.anchor) {
  const seen = new Set();
  const valid = [];
  cells.forEach((pos) => {
    const cell = getCell(pos);
    const itemKey = key(pos);
    if (!cell || cell.hidden || seen.has(itemKey)) return;
    seen.add(itemKey);
    valid.push({ row: pos.row, col: pos.col });
  });
  const fallback = firstVisibleCell() || { row: 0, col: 0 };
  const normalizedAnchor = getCell(anchor) && !getCell(anchor).hidden ? anchor : valid[0] || fallback;
  appState.selection = {
    anchor: { row: normalizedAnchor.row, col: normalizedAnchor.col },
    cells: valid.length ? valid : [{ row: fallback.row, col: fallback.col }],
  };
  return appState.selection;
}

export function firstVisibleCell() {
  for (let row = 0; row < appState.data.rows; row += 1) {
    for (let col = 0; col < appState.data.cols; col += 1) {
      const cell = getCell({ row, col });
      if (cell && !cell.hidden) return { row, col };
    }
  }
  return null;
}

export function setSelection(cells, anchor = cells[0]) {
  return normalizeSelection(cells, anchor);
}

export function rangeCells(a, b) {
  const rowStart = Math.min(a.row, b.row);
  const rowEnd = Math.max(a.row, b.row);
  const colStart = Math.min(a.col, b.col);
  const colEnd = Math.max(a.col, b.col);
  const cells = [];
  for (let row = rowStart; row <= rowEnd; row += 1) {
    for (let col = colStart; col <= colEnd; col += 1) {
      cells.push({ row, col });
    }
  }
  return cells;
}

export function selectionBounds(cells = visibleSelectedCells()) {
  if (!cells.length) return null;
  const rows = cells.map((cell) => cell.row);
  const cols = cells.map((cell) => cell.col);
  return {
    top: Math.min(...rows),
    bottom: Math.max(...rows),
    left: Math.min(...cols),
    right: Math.max(...cols),
  };
}

function key(pos) {
  return `${pos.row}:${pos.col}`;
}
