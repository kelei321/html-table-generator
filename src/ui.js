import { MAX_ZOOM, MIN_ZOOM, ZOOM_STEP } from "./config.js";
import { currentExportCode } from "./exporter.js";
import { appState, saveState } from "./state.js";
import { canMergeSelection, canUnmergeSelection, getCell } from "./table-model.js";
import { samePos, visibleSelectedCells } from "./selection.js";

export const els = {
  previewWrap: document.getElementById("table-preview-wrap"),
  tableStage: document.getElementById("table-stage"),
  contextMenu: document.getElementById("context-menu"),
  toast: document.getElementById("toast"),
  exportDrawer: document.getElementById("export-drawer"),
  exportBackdrop: document.getElementById("export-backdrop"),
  exportCode: document.getElementById("export-code"),
  gridSize: document.getElementById("grid-size"),
  rowCount: document.getElementById("row-count"),
  colCount: document.getElementById("col-count"),
  cellPosition: document.getElementById("cell-position"),
  cellContent: document.getElementById("cell-content"),
  cellColspan: document.getElementById("cell-colspan"),
  cellRowspan: document.getElementById("cell-rowspan"),
  selectionCount: document.getElementById("selection-count"),
  fontSize: document.getElementById("font-size"),
  cellPadding: document.getElementById("cell-padding"),
  textColor: document.getElementById("text-color"),
  bgColor: document.getElementById("bg-color"),
  borderColor: document.getElementById("border-color"),
  borderWidth: document.getElementById("border-width"),
  captionInput: document.getElementById("caption-input"),
  tableWidth: document.getElementById("table-width"),
  tableWidthValue: document.getElementById("table-width-value"),
  themeSelect: document.getElementById("theme-select"),
  showGuides: document.getElementById("show-guides"),
  zebraToggle: document.getElementById("zebra-toggle"),
  stickyToggle: document.getElementById("sticky-toggle"),
  pasteData: document.getElementById("paste-data"),
  saveState: document.getElementById("save-state"),
  tableName: document.getElementById("table-name"),
  zoomValue: document.getElementById("zoom-value"),
};

export function render() {
  renderPreview();
  syncControls();
  renderExport();
  syncActionState();
  syncDrawer();
  saveState(
    () => { els.saveState.textContent = "正在保存..."; },
    () => { els.saveState.textContent = "本地自动保存"; },
  );
}

export function renderPreview() {
  const data = appState.data;
  const tableWidth = data.columnWidths.reduce((sum, width) => sum + width, 0);
  const table = document.createElement("table");
  table.className = [
    "generated-table",
    `theme-${data.table.theme}`,
    data.table.zebra ? "table-zebra" : "",
    data.table.sticky ? "table-sticky" : "",
  ].filter(Boolean).join(" ");
  table.style.setProperty("--table-width", `${tableWidth}px`);

  const colgroup = document.createElement("colgroup");
  data.columnWidths.forEach((width) => {
    const col = document.createElement("col");
    col.style.width = `${width}px`;
    colgroup.append(col);
  });
  table.append(colgroup);

  if (data.caption.trim()) {
    const caption = document.createElement("caption");
    caption.textContent = data.caption;
    table.append(caption);
  }

  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");
  data.cells.forEach((rowCells, rowIndex) => {
    const tr = document.createElement("tr");
    tr.style.height = `${data.rowHeights[rowIndex]}px`;
    rowCells.forEach((cell, colIndex) => {
      if (cell.hidden) return;
      const pos = { row: rowIndex, col: colIndex };
      const node = document.createElement(rowIndex === 0 ? "th" : "td");
      node.contentEditable = samePos(appState.editingPos, pos) ? "true" : "false";
      node.tabIndex = 0;
      node.dataset.row = String(rowIndex);
      node.dataset.col = String(colIndex);
      node.rowSpan = cell.rowSpan;
      node.colSpan = cell.colSpan;
      node.append(document.createTextNode(cell.content));
      node.className = cellClass(pos);
      applyCellStyle(node, cell.style);
      appendResizeHandles(node, pos);
      tr.append(node);
    });
    (rowIndex === 0 ? thead : tbody).append(tr);
  });
  table.append(thead, tbody);

  const scaled = document.createElement("div");
  scaled.className = "table-scale";
  scaled.style.transform = `scale(${appState.ui.zoom})`;
  scaled.append(table);

  const sizeBox = document.createElement("div");
  sizeBox.className = "table-scale-box";
  sizeBox.style.width = `${tableWidth * appState.ui.zoom}px`;
  sizeBox.append(scaled);

  els.previewWrap.innerHTML = "";
  els.previewWrap.classList.toggle("guides-on", els.showGuides.checked);
  els.previewWrap.append(sizeBox);
  if (appState.editingPos) focusCell(appState.editingPos, true);
}

function appendResizeHandles(node, pos) {
  const colHandle = document.createElement("span");
  colHandle.className = "resize-handle col-resize-handle";
  colHandle.dataset.resizeType = "col";
  colHandle.dataset.index = String(pos.col);
  node.append(colHandle);

  const rowHandle = document.createElement("span");
  rowHandle.className = "resize-handle row-resize-handle";
  rowHandle.dataset.resizeType = "row";
  rowHandle.dataset.index = String(pos.row);
  node.append(rowHandle);
}

function cellClass(pos) {
  const classes = [];
  if (appState.selection.cells.some((item) => samePos(item, pos))) classes.push("range-cell");
  if (samePos(appState.selection.anchor, pos)) classes.push("selected-cell");
  if (samePos(appState.editingPos, pos)) classes.push("editing-cell");
  return classes.join(" ");
}

function applyCellStyle(node, style) {
  node.style.fontSize = `${style.fontSize}px`;
  node.style.padding = `${style.padding}px`;
  node.style.color = style.textColor;
  node.style.backgroundColor = style.bgColor;
  node.style.borderColor = style.borderColor;
  node.style.borderWidth = `${style.borderWidth}px`;
  node.style.textAlign = style.textAlign;
  node.style.fontWeight = style.fontWeight;
  node.style.fontStyle = style.fontStyle;
  node.style.textDecoration = style.textDecoration;
}

export function syncControls() {
  const data = appState.data;
  els.gridSize.textContent = `${data.rows} x ${data.cols}`;
  els.rowCount.value = data.rows;
  els.colCount.value = data.cols;
  els.captionInput.value = data.caption;
  els.tableName.textContent = data.caption || "未命名表格";
  els.tableWidth.value = data.table.width;
  els.tableWidthValue.textContent = `${data.columnWidths.reduce((sum, width) => sum + width, 0)}px`;
  els.themeSelect.value = data.table.theme;
  els.zebraToggle.checked = data.table.zebra;
  els.stickyToggle.checked = data.table.sticky;
  els.zoomValue.textContent = `${Math.round(appState.ui.zoom * 100)}%`;

  const selected = visibleSelectedCells();
  const activePos = appState.selection.anchor || selected[0] || { row: 0, col: 0 };
  const first = getCell(activePos);
  els.selectionCount.textContent = `${selected.length} 个`;
  if (!first || first.hidden) {
    els.cellPosition.textContent = "未选择";
    els.cellContent.value = "";
    return;
  }
  els.cellPosition.textContent = `R${activePos.row + 1} C${activePos.col + 1}`;
  els.cellContent.value = first.content;
  els.cellColspan.value = first.colSpan;
  els.cellRowspan.value = first.rowSpan;
  els.fontSize.value = first.style.fontSize;
  els.cellPadding.value = first.style.padding;
  els.textColor.value = first.style.textColor;
  els.bgColor.value = first.style.bgColor;
  els.borderColor.value = first.style.borderColor;
  els.borderWidth.value = first.style.borderWidth;
}

export function renderExport() {
  els.exportCode.textContent = currentExportCode();
}

export function syncActionState() {
  setActionDisabled("undo", !appState.history.length);
  setActionDisabled("redo", !appState.future.length);
  setActionDisabled("merge", !canMergeSelection());
  setActionDisabled("unmerge", !canUnmergeSelection());
  setActionDisabled("delete-row", appState.data.rows <= 1);
  setActionDisabled("delete-col", appState.data.cols <= 1);
}

function setActionDisabled(action, disabled) {
  document.querySelectorAll(`[data-action="${action}"]`).forEach((button) => {
    button.disabled = disabled;
  });
}

export function openExportDrawer() {
  appState.ui.exportDrawerOpen = true;
  syncDrawer();
}

export function closeExportDrawer() {
  appState.ui.exportDrawerOpen = false;
  syncDrawer();
}

function syncDrawer() {
  els.exportDrawer.classList.toggle("open", appState.ui.exportDrawerOpen);
  els.exportBackdrop.hidden = !appState.ui.exportDrawerOpen;
  els.exportDrawer.setAttribute("aria-hidden", String(!appState.ui.exportDrawerOpen));
}

export function setZoom(nextZoom) {
  appState.ui.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(nextZoom * 10) / 10));
  render();
}

export function changeZoom(direction) {
  setZoom(appState.ui.zoom + direction * ZOOM_STEP);
}

export function resetZoom() {
  setZoom(1);
}

export function showContextMenu(x, y) {
  els.contextMenu.hidden = false;
  const rect = els.contextMenu.getBoundingClientRect();
  els.contextMenu.style.left = `${Math.min(x, window.innerWidth - rect.width - 8)}px`;
  els.contextMenu.style.top = `${Math.min(y, window.innerHeight - rect.height - 8)}px`;
}

export function hideContextMenu() {
  els.contextMenu.hidden = true;
}

export function showToast(message) {
  window.clearTimeout(appState.toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("show");
  appState.toastTimer = window.setTimeout(() => els.toast.classList.remove("show"), 1900);
}

export function cellNode(pos) {
  return els.previewWrap.querySelector(`[data-row="${pos.row}"][data-col="${pos.col}"]`);
}

export function focusCell(pos, placeCursor = false) {
  window.requestAnimationFrame(() => {
    const node = cellNode(pos);
    if (!node) return;
    node.focus({ preventScroll: true });
    if (placeCursor && node.isContentEditable) {
      const range = document.createRange();
      range.selectNodeContents(node);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  });
}
