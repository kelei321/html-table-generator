import { defaultCellStyle } from "../config.js";
import { copyText, downloadHtml } from "../exporter.js";
import { clearSavedState, commit, initState, redo, undo } from "../state.js";
import {
  applyStyleObject,
  clearSelectedContent,
  deleteCol,
  deleteRow,
  getMergePlan,
  insertCol,
  insertRow,
  mergeSelection,
  unmergeSelected,
} from "../table-model.js";
import { setSelection } from "../selection.js";
import {
  changeZoom,
  closeExportDrawer,
  els,
  hideContextMenu,
  openExportDrawer,
  render,
  renderExport,
  resetZoom,
  showToast,
} from "../ui.js";
import { importData } from "./clipboard.js";
import { finish } from "./shared.js";

export function bindActionEvents() {
  document.addEventListener("click", handleDocumentClick);
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
    merge: handleMerge,
    unmerge: () => finish(unmergeSelected(), "已拆分单元格", "当前单元格没有可拆分内容"),
    "clear-cell": handleClearCell,
    "clear-style": () => finish(applyStyleObject({ ...defaultCellStyle }), "已清除选区样式", "请先选择单元格"),
    "import-data": () => importData(els.pasteData.value),
    reset: handleReset,
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

function handleMerge() {
  const plan = getMergePlan();
  if (!plan.ok) {
    showToast(plan.reason);
    return;
  }
  mergeSelection();
  render();
  showToast("已合并选区");
}

function handleClearCell() {
  const count = clearSelectedContent();
  render();
  showToast(count ? `已清空 ${count} 个单元格` : "没有可清空的单元格");
}

function handleReset() {
  commit();
  clearSavedState();
  initState();
  setSelection([{ row: 0, col: 0 }]);
  render();
  showToast("已重置表格");
}
