import { appState, commit } from "../state.js";
import { getCell, setCellContent, setColumnWidth, setRowHeight } from "../table-model.js";
import { rangeCells, setSelection } from "../selection.js";
import {
  els,
  focusCell,
  render,
  renderExport,
  setZoom,
  showContextMenu,
  syncControls,
} from "../ui.js";
import { handleEditingKey, startEditing } from "./keyboard.js";
import { cellPos } from "./shared.js";

export function bindTablePointerEvents() {
  document.addEventListener("mouseup", handleDocumentMouseup);
  document.addEventListener("mousemove", handleDocumentMousemove);

  els.previewWrap.addEventListener("mousedown", handlePreviewMouseDown);
  els.tableStage.addEventListener("mousedown", handleStageMouseDown);
  els.previewWrap.addEventListener("click", handlePreviewClick);
  els.previewWrap.addEventListener("mouseover", handlePreviewMouseover);
  els.previewWrap.addEventListener("dblclick", handlePreviewDblclick);
  els.previewWrap.addEventListener("contextmenu", handlePreviewContextmenu);
  els.previewWrap.addEventListener("input", handlePreviewInput);
  els.previewWrap.addEventListener("keydown", handleEditingKey, true);
  els.tableStage.addEventListener("mousemove", handleStageMousemove);
  els.tableStage.addEventListener("wheel", handleStageWheel, { passive: false });
}

function handleDocumentMouseup() {
  const shouldRender = Boolean(appState.ui.resize);
  appState.dragAnchor = null;
  appState.ui.resize = null;
  appState.ui.isPanning = false;
  els.tableStage.classList.remove("panning");
  if (shouldRender) render();
}

function handleDocumentMousemove(event) {
  const resize = appState.ui.resize;
  if (!resize) return;
  if (resize.type === "col") {
    setColumnWidth(resize.index, resize.initial + (event.clientX - resize.startX) / appState.ui.zoom);
  } else {
    setRowHeight(resize.index, resize.initial + (event.clientY - resize.startY) / appState.ui.zoom);
  }
  render();
}

function handlePreviewMouseDown(event) {
  const handle = event.target.closest(".resize-handle");
  if (handle) {
    event.preventDefault();
    event.stopPropagation();
    commit();
    const index = Number(handle.dataset.index);
    appState.ui.resize = {
      type: handle.dataset.resizeType,
      index,
      startX: event.clientX,
      startY: event.clientY,
      initial: handle.dataset.resizeType === "col" ? appState.data.columnWidths[index] : appState.data.rowHeights[index],
    };
    return;
  }
  const cell = event.target.closest("td, th");
  if (cell && !appState.editingPos) appState.dragAnchor = event.shiftKey ? appState.selection.anchor : cellPos(cell);
}

function handleStageMouseDown(event) {
  if (event.target.closest("td, th") || appState.editingPos) return;
  appState.ui.isPanning = true;
  appState.ui.panStartX = event.clientX;
  appState.ui.panStartY = event.clientY;
  appState.ui.panScrollLeft = els.tableStage.scrollLeft;
  appState.ui.panScrollTop = els.tableStage.scrollTop;
  els.tableStage.classList.add("panning");
}

function handlePreviewClick(event) {
  const cell = event.target.closest("td, th");
  if (!cell || appState.editingPos) return;
  const pos = cellPos(cell);
  setSelection(event.shiftKey ? rangeCells(appState.selection.anchor, pos) : [pos], event.shiftKey ? appState.selection.anchor : pos);
  render();
  focusCell(appState.selection.anchor);
}

function handlePreviewMouseover(event) {
  if (!appState.dragAnchor) return;
  const cell = event.target.closest("td, th");
  if (!cell) return;
  setSelection(rangeCells(appState.dragAnchor, cellPos(cell)), appState.dragAnchor);
  render();
}

function handlePreviewDblclick(event) {
  const cell = event.target.closest("td, th");
  if (cell) startEditing(cellPos(cell));
}

function handlePreviewContextmenu(event) {
  const cell = event.target.closest("td, th");
  if (!cell) return;
  event.preventDefault();
  const pos = cellPos(cell);
  if (!appState.selection.cells.some((item) => item.row === pos.row && item.col === pos.col)) {
    setSelection([pos], pos);
    render();
  }
  showContextMenu(event.clientX, event.clientY);
}

function handlePreviewInput(event) {
  const cell = event.target.closest("td, th");
  if (!cell) return;
  setCellContent(cellPos(cell), cell.textContent, false);
  renderExport();
  syncControls();
}

function handleStageMousemove(event) {
  if (!appState.ui.isPanning) return;
  els.tableStage.scrollLeft = appState.ui.panScrollLeft - (event.clientX - appState.ui.panStartX);
  els.tableStage.scrollTop = appState.ui.panScrollTop - (event.clientY - appState.ui.panStartY);
}

function handleStageWheel(event) {
  if (!event.ctrlKey && !event.metaKey) return;
  event.preventDefault();
  setZoom(appState.ui.zoom + (event.deltaY < 0 ? 0.1 : -0.1));
}
