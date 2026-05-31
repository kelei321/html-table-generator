import { DEFAULT_COLUMN_WIDTH, DEFAULT_ROW_HEIGHT, defaultCellStyle } from "./config.js";
import { copyText, downloadHtml } from "./exporter.js";
import { appState, clearSavedState, commit, initState, redo, undo } from "./state.js";
import {
  applyStyle,
  applyStyleObject,
  clearSelectedContent,
  clamp,
  deleteCol,
  deleteRow,
  ensureGridSize,
  getCell,
  getMergePlan,
  insertCol,
  insertRow,
  mergeSelection,
  createBlankCell,
  createBlankState,
  resizeGrid,
  scaleColumnWidths,
  setCellContent,
  setColumnWidth,
  setRowHeight,
  unmergeSelected,
} from "./table-model.js";
import { firstVisibleCell, rangeCells, setSelection, visibleSelectedCells } from "./selection.js";
import {
  cellNode,
  changeZoom,
  closeExportDrawer,
  els,
  focusCell,
  hideContextMenu,
  openExportDrawer,
  render,
  renderExport,
  resetZoom,
  setZoom,
  showContextMenu,
  showToast,
  syncControls,
} from "./ui.js";

export function bindEvents() {
  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("keydown", handleKeydown);
  document.addEventListener("paste", handlePaste);
  document.addEventListener("mouseup", () => {
    const shouldRender = Boolean(appState.ui.resize);
    appState.dragAnchor = null;
    appState.ui.resize = null;
    appState.ui.isPanning = false;
    els.tableStage.classList.remove("panning");
    if (shouldRender) render();
  });
  document.addEventListener("mousemove", handleDocumentMousemove);

  bindTableEvents();
  bindControls();
}

function handleDocumentClick(event) {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!event.target.closest(".context-menu")) hideContextMenu();
  if (!action) return;

  const actions = {
    undo: () => finish(undo(), "已撤销", "没有可撤销的操作"),
    redo: () => finish(redo(), "已重做", "没有可重做的操作"),
    "add-row": () => finish(insertRow("below"), "已在下方插入行", "插入行失败"),
    "add-col": () => finish(insertCol("right"), "已在右侧插入列", "插入列失败"),
    "insert-row-above": () => finish(insertRow("above"), "已在上方插入行", "插入行失败"),
    "insert-row-below": () => finish(insertRow("below"), "已在下方插入行", "插入行失败"),
    "insert-col-left": () => finish(insertCol("left"), "已在左侧插入列", "插入列失败"),
    "insert-col-right": () => finish(insertCol("right"), "已在右侧插入列", "插入列失败"),
    "delete-row": () => finish(deleteRow(), "已删除当前行", "至少保留 1 行"),
    "delete-col": () => finish(deleteCol(), "已删除当前列", "至少保留 1 列"),
    merge: () => {
      const plan = getMergePlan();
      if (!plan.ok) {
        showToast(plan.reason);
        return;
      }
      mergeSelection();
      render();
      showToast("已合并选区");
    },
    unmerge: () => finish(unmergeSelected(), "已拆分单元格", "当前单元格没有可拆分内容"),
    "clear-cell": () => {
      const count = clearSelectedContent();
      render();
      showToast(count ? `已清空 ${count} 个单元格` : "没有可清空的单元格");
    },
    "clear-style": () => finish(applyStyleObject({ ...defaultCellStyle }), "已清除选区样式", "请先选择单元格"),
    "import-data": () => importData(els.pasteData.value),
    reset: () => {
      commit();
      clearSavedState();
      initState();
      setSelection([{ row: 0, col: 0 }]);
      render();
      showToast("已重置表格");
    },
    download: () => {
      downloadHtml();
      showToast("已生成下载文件");
    },
    "open-export": () => {
      openExportDrawer();
      renderExport();
    },
    "close-export": closeExportDrawer,
    "copy-code": async () => {
      await copyText(els.exportCode.textContent);
      showToast("已复制导出代码");
    },
    "zoom-in": () => changeZoom(1),
    "zoom-out": () => changeZoom(-1),
    "zoom-reset": resetZoom,
  };

  actions[action]?.();
}

function finish(ok, success, failure) {
  render();
  showToast(ok ? success : failure);
}

function bindTableEvents() {
  els.previewWrap.addEventListener("mousedown", (event) => {
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
  });

  els.tableStage.addEventListener("mousedown", (event) => {
    if (event.target.closest("td, th") || appState.editingPos) return;
    appState.ui.isPanning = true;
    appState.ui.panStartX = event.clientX;
    appState.ui.panStartY = event.clientY;
    appState.ui.panScrollLeft = els.tableStage.scrollLeft;
    appState.ui.panScrollTop = els.tableStage.scrollTop;
    els.tableStage.classList.add("panning");
  });

  els.previewWrap.addEventListener("click", (event) => {
    const cell = event.target.closest("td, th");
    if (!cell || appState.editingPos) return;
    const pos = cellPos(cell);
    setSelection(event.shiftKey ? rangeCells(appState.selection.anchor, pos) : [pos], event.shiftKey ? appState.selection.anchor : pos);
    render();
    focusCell(appState.selection.anchor);
  });

  els.previewWrap.addEventListener("mouseover", (event) => {
    if (!appState.dragAnchor) return;
    const cell = event.target.closest("td, th");
    if (!cell) return;
    setSelection(rangeCells(appState.dragAnchor, cellPos(cell)), appState.dragAnchor);
    render();
  });

  els.previewWrap.addEventListener("dblclick", (event) => {
    const cell = event.target.closest("td, th");
    if (cell) startEditing(cellPos(cell));
  });

  els.previewWrap.addEventListener("contextmenu", (event) => {
    const cell = event.target.closest("td, th");
    if (!cell) return;
    event.preventDefault();
    const pos = cellPos(cell);
    if (!appState.selection.cells.some((item) => item.row === pos.row && item.col === pos.col)) {
      setSelection([pos], pos);
      render();
    }
    showContextMenu(event.clientX, event.clientY);
  });

  els.previewWrap.addEventListener("input", (event) => {
    const cell = event.target.closest("td, th");
    if (!cell) return;
    setCellContent(cellPos(cell), cell.textContent, false);
    renderExport();
    syncControls();
  });

  els.previewWrap.addEventListener("keydown", (event) => {
    handleEditingKey(event);
  }, true);

  els.tableStage.addEventListener("mousemove", (event) => {
    if (!appState.ui.isPanning) return;
    els.tableStage.scrollLeft = appState.ui.panScrollLeft - (event.clientX - appState.ui.panStartX);
    els.tableStage.scrollTop = appState.ui.panScrollTop - (event.clientY - appState.ui.panStartY);
  });

  els.tableStage.addEventListener("wheel", (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    setZoom(appState.ui.zoom + (event.deltaY < 0 ? 0.1 : -0.1));
  }, { passive: false });
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

function bindControls() {
  els.exportBackdrop.addEventListener("click", closeExportDrawer);
  els.cellContent.addEventListener("change", () => {
    finish(setCellContent(appState.selection.anchor, els.cellContent.value), "已更新单元格", "请先选择可编辑单元格");
  });
  els.rowCount.addEventListener("change", () => { resizeGrid(Number(els.rowCount.value), appState.data.cols); render(); });
  els.colCount.addEventListener("change", () => { resizeGrid(appState.data.rows, Number(els.colCount.value)); render(); });
  els.captionInput.addEventListener("input", () => { appState.data.caption = els.captionInput.value; render(); });
  els.tableWidth.addEventListener("input", () => {
    commit();
    scaleColumnWidths(Number(els.tableWidth.value));
    render();
  });
  els.themeSelect.addEventListener("change", () => { appState.data.table.theme = els.themeSelect.value; render(); });
  els.zebraToggle.addEventListener("change", () => { appState.data.table.zebra = els.zebraToggle.checked; render(); });
  els.stickyToggle.addEventListener("change", () => { appState.data.table.sticky = els.stickyToggle.checked; render(); });
  els.showGuides.addEventListener("change", render);

  [els.fontSize, els.cellPadding, els.borderWidth].forEach((input) => {
    input.addEventListener("change", () => {
      const map = { "font-size": "fontSize", "cell-padding": "padding", "border-width": "borderWidth" };
      finish(applyStyle(map[input.id], Number(input.value)), "已应用样式", "请先选择单元格");
    });
  });
  [els.textColor, els.bgColor, els.borderColor].forEach((input) => {
    input.addEventListener("input", () => {
      const map = { "text-color": "textColor", "bg-color": "bgColor", "border-color": "borderColor" };
      finish(applyStyle(map[input.id], input.value), "已应用样式", "请先选择单元格");
    });
  });
  document.querySelectorAll("[data-style]").forEach((button) => {
    button.addEventListener("click", () => finish(applyStyle(button.dataset.style, button.dataset.value), "已应用样式", "请先选择单元格"));
  });
  document.querySelectorAll("[data-export-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-export-tab]").forEach((node) => node.classList.remove("active"));
      button.classList.add("active");
      appState.exportTab = button.dataset.exportTab;
      renderExport();
    });
  });
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

function handleEditingKey(event) {
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

function startEditing(pos = appState.selection.anchor) {
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

function handlePaste(event) {
  if (isFormTarget(event.target) || appState.editingPos) return;
  const text = event.clipboardData?.getData("text/plain");
  if (!text) return;
  event.preventDefault();
  pasteMatrixAtAnchor(parseDelimited(text));
}

function importData(raw) {
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

function parseDelimited(raw) {
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

function pasteMatrixAtAnchor(matrix) {
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

function copySelectionAsTsv() {
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
  render();
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
      render();
      focusCell(target);
      return;
    }
    index = (index + (reverse ? -1 : 1) + appState.data.rows * appState.data.cols) % (appState.data.rows * appState.data.cols);
  }
}

function cellPos(cell) {
  return { row: Number(cell.dataset.row), col: Number(cell.dataset.col) };
}

function isFormTarget(target) {
  return Boolean(target.closest?.("input, textarea, select"));
}
