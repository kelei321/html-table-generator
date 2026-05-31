import { appState, commit } from "../state.js";
import {
  applyStyle,
  resizeGrid,
  scaleColumnWidths,
  setCellContent,
} from "../table-model.js";
import { closeExportDrawer, els, render, renderExport } from "../ui.js";
import { finish } from "./shared.js";

export function bindControlEvents() {
  els.exportBackdrop.addEventListener("click", closeExportDrawer);
  els.cellContent.addEventListener("change", () => {
    finish(setCellContent(appState.selection.anchor, els.cellContent.value), "已更新单元格", "请先选择可编辑单元格");
  });
  els.rowCount.addEventListener("change", () => {
    resizeGrid(Number(els.rowCount.value), appState.data.cols);
    render();
  });
  els.colCount.addEventListener("change", () => {
    resizeGrid(appState.data.rows, Number(els.colCount.value));
    render();
  });
  els.captionInput.addEventListener("input", () => {
    appState.data.caption = els.captionInput.value;
    render();
  });
  els.tableWidth.addEventListener("input", () => {
    commit();
    scaleColumnWidths(Number(els.tableWidth.value));
    render();
  });
  els.themeSelect.addEventListener("change", () => {
    appState.data.table.theme = els.themeSelect.value;
    render();
  });
  els.zebraToggle.addEventListener("change", () => {
    appState.data.table.zebra = els.zebraToggle.checked;
    render();
  });
  els.stickyToggle.addEventListener("change", () => {
    appState.data.table.sticky = els.stickyToggle.checked;
    render();
  });
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
