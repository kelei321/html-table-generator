import { DEFAULT_COLUMN_WIDTH, DEFAULT_ROW_HEIGHT } from "../config.js";
import { appState, commit } from "../state.js";
import { createBlankCell, ensureGridSize, getCell } from "../table-model.js";
import { firstVisibleCell, setSelection, visibleSelectedCells } from "../selection.js";
import { render, showToast } from "../ui.js";
import { isFormTarget } from "./shared.js";

export function bindClipboardEvents() {
  document.addEventListener("paste", handlePaste);
}

function handlePaste(event) {
  if (isFormTarget(event.target) || appState.editingPos) return;
  const text = event.clipboardData?.getData("text/plain");
  if (!text) return;
  event.preventDefault();
  pasteMatrixAtAnchor(parseDelimited(text));
}

export function importData(raw) {
  const matrix = parseDelimited(raw);
  if (!matrix.length) {
    showToast("没有可导入的数据");
    return;
  }
  commit();
  const rows = Math.max(1, matrix.length);
  const cols = Math.max(1, Math.max(...matrix.map((line) => line.length)));
  appState.data.rows = rows;
  appState.data.cols = cols;
  appState.data.columnWidths = Array.from({ length: cols }, () => DEFAULT_COLUMN_WIDTH);
  appState.data.rowHeights = Array.from({ length: rows }, () => DEFAULT_ROW_HEIGHT);
  appState.data.cells = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => createBlankCell(matrix[row]?.[col] || "")),
  );
  setSelection([{ row: 0, col: 0 }]);
  render();
  showToast(`已导入 ${rows} 行 ${cols} 列`);
}

export function parseDelimited(raw) {
  const text = raw.trim();
  if (!text) return [];
  const delimiter = text.includes("\t") ? "\t" : ",";
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      row.push(field.trim());
      field = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field.trim());
  rows.push(row);
  return rows.filter((items) => items.some(Boolean));
}

export function pasteMatrixAtAnchor(matrix) {
  if (!matrix.length) return;
  const anchor = getCell(appState.selection.anchor)?.hidden ? firstVisibleCell() : appState.selection.anchor;
  commit();
  ensureGridSize(anchor.row + matrix.length, anchor.col + Math.max(...matrix.map((row) => row.length)));
  let pasted = 0;
  let skipped = 0;
  matrix.forEach((line, rowOffset) => {
    let col = anchor.col;
    line.forEach((value) => {
      while (col < appState.data.cols && getCell({ row: anchor.row + rowOffset, col })?.hidden) {
        skipped += 1;
        col += 1;
      }
      if (anchor.row + rowOffset >= appState.data.rows || col >= appState.data.cols) {
        skipped += 1;
        return;
      }
      getCell({ row: anchor.row + rowOffset, col }).content = value;
      pasted += 1;
      col += 1;
    });
  });
  setSelection([anchor], anchor);
  render();
  showToast(skipped ? `已粘贴 ${pasted} 个单元格，部分内容被跳过` : `已粘贴 ${pasted} 个单元格`);
}

export function copySelectionAsTsv() {
  const cells = visibleSelectedCells();
  if (!cells.length) return "";
  const rows = cells.map((pos) => pos.row);
  const cols = cells.map((pos) => pos.col);
  const top = Math.min(...rows);
  const bottom = Math.max(...rows);
  const left = Math.min(...cols);
  const right = Math.max(...cols);
  const selectedKeys = new Set(cells.map((pos) => `${pos.row}:${pos.col}`));
  const lines = [];
  for (let row = top; row <= bottom; row += 1) {
    const values = [];
    for (let col = left; col <= right; col += 1) {
      values.push(selectedKeys.has(`${row}:${col}`) ? getCell({ row, col }).content : "");
    }
    lines.push(values.join("\t"));
  }
  return lines.join("\n");
}
