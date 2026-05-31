import { appState } from "./state.js";

export function currentExportCode() {
  const html = buildHtml();
  const css = buildCss();
  const full = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(appState.data.caption || "Generated Table")}</title>
    <style>
${indent(css, 6)}
    </style>
  </head>
  <body>
${indent(html, 4)}
  </body>
</html>`;
  return appState.exportTab === "html" ? html : appState.exportTab === "css" ? css : full;
}

export function buildHtml() {
  const table = appState.data.table;
  const lines = [`<table class="htg-table htg-${table.theme}${table.zebra ? " htg-zebra" : ""}${table.sticky ? " htg-sticky" : ""}">`];
  if (appState.data.caption.trim()) lines.push(`  <caption>${escapeHtml(appState.data.caption)}</caption>`);
  lines.push("  <colgroup>");
  appState.data.columnWidths.forEach((width) => {
    lines.push(`    <col style="width: ${width}px;" />`);
  });
  lines.push("  </colgroup>");
  lines.push("  <thead>");
  lines.push(rowToHtml(0, "th", 4));
  lines.push("  </thead>");
  lines.push("  <tbody>");
  for (let row = 1; row < appState.data.rows; row += 1) lines.push(rowToHtml(row, "td", 4));
  lines.push("  </tbody>");
  lines.push("</table>");
  return lines.join("\n");
}

function rowToHtml(rowIndex, tag, indentSize) {
  const pad = " ".repeat(indentSize);
  const height = appState.data.rowHeights[rowIndex];
  const lines = [`${pad}<tr style="height: ${height}px;">`];
  appState.data.cells[rowIndex].forEach((cell) => {
    if (cell.hidden) return;
    const attrs = [
      cell.rowSpan > 1 ? `rowspan="${cell.rowSpan}"` : "",
      cell.colSpan > 1 ? `colspan="${cell.colSpan}"` : "",
      `style="${styleToInline(cell.style)}"`,
    ].filter(Boolean).join(" ");
    lines.push(`${pad}  <${tag} ${attrs}>${escapeHtml(cell.content)}</${tag}>`);
  });
  lines.push(`${pad}</tr>`);
  return lines.join("\n");
}

export function buildCss() {
  const totalWidth = appState.data.columnWidths.reduce((sum, width) => sum + width, 0);
  return `.htg-table {
  width: ${totalWidth}px;
  border-collapse: collapse;
  table-layout: fixed;
  font-family: Arial, "Microsoft YaHei", sans-serif;
  color: #182230;
}

.htg-table caption {
  caption-side: top;
  text-align: left;
  padding: 0 0 12px;
  font-size: 18px;
  font-weight: 700;
}

.htg-table th,
.htg-table td {
  line-height: 1.4;
  vertical-align: middle;
}

.htg-clean thead th { background: #eef4ff; color: #173b78; }
.htg-editorial thead th { background: #111827; color: #ffffff; }
.htg-finance thead th { background: #ecfdf3; color: #05603a; }
.htg-contrast thead th { background: #fef3c7; color: #78350f; }
.htg-zebra tbody tr:nth-child(even) td { background-image: linear-gradient(rgba(15, 23, 42, 0.035), rgba(15, 23, 42, 0.035)); }
.htg-sticky thead th { position: sticky; top: 0; z-index: 1; }`;
}

export function styleToInline(style) {
  return [
    `font-size:${style.fontSize}px`,
    `padding:${style.padding}px`,
    `color:${style.textColor}`,
    `background-color:${style.bgColor}`,
    `border:${style.borderWidth}px solid ${style.borderColor}`,
    `text-align:${style.textAlign}`,
    `font-weight:${style.fontWeight}`,
    `font-style:${style.fontStyle}`,
    `text-decoration:${style.textDecoration}`,
  ].join(";");
}

export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

export function downloadHtml() {
  const currentTab = appState.exportTab;
  appState.exportTab = "full";
  const blob = new Blob([currentExportCode()], { type: "text/html;charset=utf-8" });
  appState.exportTab = currentTab;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "generated-table.html";
  a.click();
  URL.revokeObjectURL(url);
}

export function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function indent(value, size) {
  const pad = " ".repeat(size);
  return value.split("\n").map((line) => `${pad}${line}`).join("\n");
}
