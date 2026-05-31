import { copyText } from "../exporter.js";
import { appState, redo, undo, commit } from "../state.js";
import { clearSelectedContent, clamp, getCell, setCellContent } from "../table-model.js";
import { rangeCells, setSelection } from "../selection.js";
import { cellNode, closeExportDrawer, focusCell, render, renderExport, scheduleRender, showToast, syncControls } from "../ui.js";
import { copySelectionAsTsv } from "./clipboard.js";
import { cellPos, finish, isFormTarget } from "./shared.js";

export function bindKeyboardEvents() {
  document.addEventListener("keydown", handleKeydown);
}

async function handleKeydown(event) {
  if (event.defaultPrevented || isFormTarget(event.target)) return;
  const meta = event.ctrlKey || event.metaKey;
  if (event.key === "Escape" && appState.ui.exportDrawerOpen) {
    closeExportDrawer();
    return;
  }
  if (meta && event.key.toLowerCase() === "z") {
    event.preventDefault();
    finish(event.shiftKey ? redo() : undo(), event.shiftKey ? "已重做" : "已撤销", "没有可执行的历史操作");
    return;
  }
  if (meta && event.key.toLowerCase() === "y") {
    event.preventDefault();
    finish(redo(), "已重做", "没有可重做的操作");
    return;
  }
  if (meta && event.key.toLowerCase() === "c") {
    event.preventDefault();
    await copyText(copySelectionAsTsv());
    showToast("已复制选区为 TSV");
    return;
  }
  if (appState.editingPos) {
    handleEditingKey(event);
    return;
  }
  const movement = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[event.key];
  if (movement) {
    event.preventDefault();
    moveSelection(movement[0], movement[1], event.shiftKey);
  } else if (event.key === "Tab") {
    event.preventDefault();
    moveTab(event.shiftKey);
  } else if (event.key === "Enter") {
    event.preventDefault();
    startEditing();
  } else if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();
    const count = clearSelectedContent();
    render();
    showToast(count ? `已清空 ${count} 个单元格` : "没有可清空的单元格");
  } else if (!meta && event.target.closest?.("td, th") && event.key.length === 1) {
    event.preventDefault();
    startEditing(cellPos(event.target.closest("td, th")));
    updateEditingContent(event.key);
  }
}

export function handleEditingKey(event) {
  if (!appState.editingPos) return false;
  const meta = event.ctrlKey || event.metaKey;
  if (event.key === "Escape") {
    event.preventDefault();
    stopEditing(true);
  } else if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    stopEditing(false);
  } else if (event.key === "Backspace") {
    event.preventDefault();
    updateEditingContent((getCell(appState.editingPos)?.content || "").slice(0, -1));
  } else if (!meta && event.key.length === 1) {
    event.preventDefault();
    updateEditingContent((getCell(appState.editingPos)?.content || "") + event.key);
  }
}

export function startEditing(pos = appState.selection.anchor) {
  const cell = getCell(pos);
  if (!cell || cell.hidden) return;
  commit();
  appState.editingPos = { row: pos.row, col: pos.col };
  appState.editingOriginal = cell.content;
  setSelection([pos], pos);
  render();
  showToast("进入编辑，Enter 提交，Esc 取消");
}

function stopEditing(cancel = false) {
  if (!appState.editingPos) return;
  if (cancel) setCellContent(appState.editingPos, appState.editingOriginal, false);
  appState.editingPos = null;
  appState.editingOriginal = "";
  render();
}

function updateEditingContent(value) {
  const cell = getCell(appState.editingPos);
  if (!cell) return;
  cell.content = value;
  const node = cellNode(appState.editingPos);
  if (node) node.textContent = value;
  renderExport();
  syncControls();
}

function moveSelection(deltaRow, deltaCol, extend = false) {
  const base = extend ? appState.selection.anchor : appState.selection.cells.at(-1) || appState.selection.anchor;
  let row = clamp(base.row + deltaRow, 0, appState.data.rows - 1);
  let col = clamp(base.col + deltaCol, 0, appState.data.cols - 1);
  let guard = appState.data.rows * appState.data.cols;
  while (getCell({ row, col })?.hidden && guard > 0) {
    row = clamp(row + Math.sign(deltaRow), 0, appState.data.rows - 1);
    col = clamp(col + Math.sign(deltaCol), 0, appState.data.cols - 1);
    guard -= 1;
  }
  const target = { row, col };
  setSelection(extend ? rangeCells(appState.selection.anchor, target) : [target], extend ? appState.selection.anchor : target);
  scheduleRender("selection");
  focusCell(target);
}

function moveTab(reverse = false) {
  const current = appState.selection.anchor;
  let index = current.row * appState.data.cols + current.col + (reverse ? -1 : 1);
  index = (index + appState.data.rows * appState.data.cols) % (appState.data.rows * appState.data.cols);
  for (let guard = 0; guard < appState.data.rows * appState.data.cols; guard += 1) {
    const target = { row: Math.floor(index / appState.data.cols), col: index % appState.data.cols };
    if (!getCell(target)?.hidden) {
      setSelection([target], target);
      scheduleRender("selection");
      focusCell(target);
      return;
    }
    index = (index + (reverse ? -1 : 1) + appState.data.rows * appState.data.cols) % (appState.data.rows * appState.data.cols);
  }
}
