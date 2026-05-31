import {
  DEFAULT_COLS,
  DEFAULT_COLUMN_WIDTH,
  DEFAULT_ROW_HEIGHT,
  DEFAULT_ROWS,
  defaultCellStyle,
  MIN_COLUMN_WIDTH,
  MIN_ROW_HEIGHT,
} from "./config.js";
import { appState, commit } from "./state.js";
import { normalizeSelection, visibleSelectedCells } from "./selection.js";

export function createBlankState(rows = DEFAULT_ROWS, cols = DEFAULT_COLS) {
  return {
    rows,
    cols,
    caption: "",
    table: { width: cols * DEFAULT_COLUMN_WIDTH, theme: "clean", zebra: false, sticky: false },
    columnWidths: Array.from({ length: cols }, () => DEFAULT_COLUMN_WIDTH),
    rowHeights: Array.from({ length: rows }, () => DEFAULT_ROW_HEIGHT),
    cells: Array.from({ length: rows }, () => Array.from({ length: cols }, () => createBlankCell())),
  };
}

export function createBlankCell(content = "", isHeader = false, style = defaultCellStyle) {
  return {
    id: crypto.randomUUID(),
    content,
    rowSpan: 1,
    colSpan: 1,
    hidden: false,
    style: {
      ...style,
      ...(isHeader ? { fontWeight: "700", bgColor: "#eef4ff", textColor: "#173b78" } : {}),
    },
  };
}

export function getCell(pos) {
  if (!pos) return null;
  return appState.data.cells[pos.row]?.[pos.col] || null;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function resizeGrid(rows, cols, shouldCommit = true) {
  rows = Math.max(1, Math.floor(rows || 1));
  cols = Math.max(1, Math.floor(cols || 1));
  if (shouldCommit) commit();
  unmergeAll(false);
  ensureGridSize(rows, cols);
  appState.selection = { anchor: { row: 0, col: 0 }, cells: [{ row: 0, col: 0 }] };
}

export function ensureGridSize(rows, cols) {
  const nextRows = Math.max(1, Math.floor(rows || 1));
  const nextCols = Math.max(1, Math.floor(cols || 1));
  while (appState.data.cells.length < nextRows) {
    appState.data.cells.push(Array.from({ length: appState.data.cols }, () => createBlankCell()));
    appState.data.rowHeights.push(DEFAULT_ROW_HEIGHT);
  }
  appState.data.cells.length = nextRows;
  appState.data.rowHeights.length = nextRows;
  appState.data.cells.forEach((row) => {
    while (row.length < nextCols) row.push(createBlankCell());
    row.length = nextCols;
  });
  while (appState.data.columnWidths.length < nextCols) appState.data.columnWidths.push(DEFAULT_COLUMN_WIDTH);
  appState.data.columnWidths.length = nextCols;
  appState.data.rows = nextRows;
  appState.data.cols = nextCols;
}

export function insertRow(where = "below") {
  commit();
  unmergeAll(false);
  const target = where === "above" ? appState.selection.anchor.row : appState.selection.anchor.row + 1;
  appState.data.cells.splice(target, 0, Array.from({ length: appState.data.cols }, () => createBlankCell()));
  appState.data.rowHeights.splice(target, 0, DEFAULT_ROW_HEIGHT);
  appState.data.rows += 1;
  appState.selection = normalizeSelection([{ row: clamp(target, 0, appState.data.rows - 1), col: appState.selection.anchor.col }]);
  return true;
}

export function insertCol(where = "right") {
  commit();
  unmergeAll(false);
  const target = where === "left" ? appState.selection.anchor.col : appState.selection.anchor.col + 1;
  appState.data.cells.forEach((row) => row.splice(target, 0, createBlankCell()));
  appState.data.columnWidths.splice(target, 0, DEFAULT_COLUMN_WIDTH);
  appState.data.cols += 1;
  appState.selection = normalizeSelection([{ row: appState.selection.anchor.row, col: clamp(target, 0, appState.data.cols - 1) }]);
  return true;
}

export function deleteRow() {
  if (appState.data.rows <= 1) return false;
  commit();
  unmergeAll(false);
  const target = appState.selection.anchor.row;
  appState.data.cells.splice(target, 1);
  appState.data.rowHeights.splice(target, 1);
  appState.data.rows -= 1;
  appState.selection = normalizeSelection([{ row: Math.min(target, appState.data.rows - 1), col: 0 }]);
  return true;
}

export function deleteCol() {
  if (appState.data.cols <= 1) return false;
  commit();
  unmergeAll(false);
  const target = appState.selection.anchor.col;
  appState.data.cells.forEach((row) => row.splice(target, 1));
  appState.data.columnWidths.splice(target, 1);
  appState.data.cols -= 1;
  appState.selection = normalizeSelection([{ row: 0, col: Math.min(target, appState.data.cols - 1) }]);
  return true;
}

export function setColumnWidth(index, width) {
  appState.data.columnWidths[index] = Math.max(MIN_COLUMN_WIDTH, Math.round(width));
}

export function setRowHeight(index, height) {
  appState.data.rowHeights[index] = Math.max(MIN_ROW_HEIGHT, Math.round(height));
}

export function scaleColumnWidths(totalWidth) {
  const target = Math.max(appState.data.cols * MIN_COLUMN_WIDTH, Math.round(totalWidth || 0));
  const current = appState.data.columnWidths.reduce((sum, width) => sum + width, 0) || 1;
  appState.data.columnWidths = appState.data.columnWidths.map((width) => Math.max(MIN_COLUMN_WIDTH, Math.round((width / current) * target)));
  appState.data.table.width = appState.data.columnWidths.reduce((sum, width) => sum + width, 0);
}

export function clearSelectedContent() {
  const selected = visibleSelectedCells();
  if (!selected.length) return 0;
  commit();
  selected.forEach((pos) => {
    getCell(pos).content = "";
  });
  appState.editingPos = null;
  return selected.length;
}

export function applyStyle(prop, value) {
  const selected = visibleSelectedCells();
  if (!selected.length) return false;
  commit();
  selected.forEach((pos) => {
    const style = getCell(pos).style;
    if (["fontWeight", "fontStyle", "textDecoration"].includes(prop)) {
      style[prop] = style[prop] === value ? defaultCellStyle[prop] : value;
    } else {
      style[prop] = value;
    }
  });
  return true;
}

export function applyStyleObject(style) {
  const selected = visibleSelectedCells();
  if (!selected.length) return false;
  commit();
  selected.forEach((pos) => {
    getCell(pos).style = { ...style };
  });
  return true;
}

export function setCellContent(pos, value, shouldCommit = true) {
  const cell = getCell(pos);
  if (!cell || cell.hidden) return false;
  if (shouldCommit) commit();
  cell.content = value;
  return true;
}

export function canMergeSelection() {
  return getMergePlan().ok;
}

export function mergeSelection() {
  const plan = getMergePlan();
  if (!plan.ok) return plan;
  commit();

  plan.visibleCells.forEach((pos) => {
    const cell = getCell(pos);
    cell.hidden = false;
    cell.rowSpan = 1;
    cell.colSpan = 1;
  });

  const master = getCell(plan.master);
  const masterStyle = { ...master.style };
  master.rowSpan = plan.bottom - plan.top + 1;
  master.colSpan = plan.right - plan.left + 1;
  master.style = masterStyle;
  master.content = plan.visibleCells
    .map((pos) => getCell(pos).content.trim())
    .filter(Boolean)
    .join(" ");

  for (let row = plan.top; row <= plan.bottom; row += 1) {
    for (let col = plan.left; col <= plan.right; col += 1) {
      const pos = { row, col };
      if (pos.row === plan.master.row && pos.col === plan.master.col) continue;
      const cell = getCell(pos);
      if (!cell) continue;
      cell.hidden = true;
      cell.rowSpan = 1;
      cell.colSpan = 1;
      cell.content = "";
    }
  }

  appState.selection = { anchor: plan.master, cells: [plan.master] };
  appState.editingPos = null;
  return { ok: true };
}

export function getMergePlan() {
  const selected = visibleSelectedCells();
  if (selected.length < 2) return { ok: false, reason: "请选择至少 2 个单元格" };
  const expanded = expandSelectionCoverage(selected);
  if (!expanded.ok) return expanded;
  const { top, bottom, left, right, coveredKeys, visibleCells } = expanded;
  if (coveredKeys.size !== (bottom - top + 1) * (right - left + 1)) {
    return { ok: false, reason: "选区必须形成完整矩形" };
  }
  const master = findTopLeftVisibleCell(visibleCells);
  return { ok: true, top, bottom, left, right, visibleCells, master };
}

function expandSelectionCoverage(selected) {
  const selectedKeys = new Set(selected.map((pos) => key(pos)));
  const coveredKeys = new Set();
  let top = Infinity;
  let bottom = -Infinity;
  let left = Infinity;
  let right = -Infinity;
  const visibleCells = [];

  for (const pos of selected) {
    const cell = getCell(pos);
    if (!cell || cell.hidden) continue;
    const coverage = cellCoverage(pos, cell);
    for (const required of coverage.coveredVisibleCells) {
      if (!selectedKeys.has(key(required))) {
        return { ok: false, reason: "已合并单元格必须完整选中后才能继续合并" };
      }
    }
    visibleCells.push(pos);
    for (let row = coverage.top; row <= coverage.bottom; row += 1) {
      for (let col = coverage.left; col <= coverage.right; col += 1) {
        coveredKeys.add(`${row}:${col}`);
      }
    }
    top = Math.min(top, coverage.top);
    bottom = Math.max(bottom, coverage.bottom);
    left = Math.min(left, coverage.left);
    right = Math.max(right, coverage.right);
  }

  return { ok: true, top, bottom, left, right, coveredKeys, visibleCells };
}

function cellCoverage(pos, cell) {
  const top = pos.row;
  const left = pos.col;
  const bottom = pos.row + cell.rowSpan - 1;
  const right = pos.col + cell.colSpan - 1;
  const coveredVisibleCells = [];
  for (let row = top; row <= bottom; row += 1) {
    for (let col = left; col <= right; col += 1) {
      const covered = getCell({ row, col });
      if (covered && !covered.hidden) coveredVisibleCells.push({ row, col });
    }
  }
  return { top, bottom, left, right, coveredVisibleCells };
}

function findTopLeftVisibleCell(cells) {
  return [...cells].sort((a, b) => a.row - b.row || a.col - b.col)[0];
}

export function canUnmergeSelection() {
  const cell = getCell(appState.selection.anchor);
  return Boolean(cell && !cell.hidden && (cell.rowSpan > 1 || cell.colSpan > 1));
}

export function unmergeSelected() {
  if (!canUnmergeSelection()) return false;
  commit();
  const { row, col } = appState.selection.anchor;
  const cell = getCell(appState.selection.anchor);
  const rowSpan = cell.rowSpan;
  const colSpan = cell.colSpan;
  cell.rowSpan = 1;
  cell.colSpan = 1;
  for (let r = row; r < row + rowSpan; r += 1) {
    for (let c = col; c < col + colSpan; c += 1) {
      if (r === row && c === col) continue;
      const covered = getCell({ row: r, col: c });
      if (!covered) continue;
      covered.hidden = false;
      covered.content = "";
      covered.style = { ...cell.style };
    }
  }
  return true;
}

export function unmergeAll() {
  appState.data.cells.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (cell.rowSpan > 1 || cell.colSpan > 1) {
        for (let r = rowIndex; r < rowIndex + cell.rowSpan; r += 1) {
          for (let c = colIndex; c < colIndex + cell.colSpan; c += 1) {
            if (r === rowIndex && c === colIndex) continue;
            const covered = getCell({ row: r, col: c });
            if (covered) covered.hidden = false;
          }
        }
        cell.rowSpan = 1;
        cell.colSpan = 1;
      }
    });
  });
}

function key(pos) {
  return `${pos.row}:${pos.col}`;
}
