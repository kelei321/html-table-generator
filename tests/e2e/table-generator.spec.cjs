const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const STORAGE_KEY = "html-table-generator:v1";

async function run({ baseUrl }) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  try {
    await page.goto(baseUrl);
    await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
    await page.reload();
    await page.waitForSelector(".generated-table");

    await expectDefaultBlankGrid(page);
    await expectLargeGridResize(page);
    await expectMergeAndUnmerge(page);
    await expectDimensionDragAndRestore(page);
    await expectImportAndPaste(page);
    await expectExportDrawer(page);
    await expectExportQuality(page);
    await expectLargeTableInteractions(page);
    await expectLegacyStorageMigration(page, baseUrl);

    assert.deepEqual(consoleErrors, []);
  } finally {
    await context.close();
    await browser.close();
  }
}

async function expectDefaultBlankGrid(page) {
  assert.equal(await page.locator(".generated-table tr").count(), 5);
  assert.equal(await page.locator(".generated-table th, .generated-table td").count(), 20);
  assert.equal(await page.locator("#grid-size").textContent(), "5 x 4");
  const text = await page.locator(".generated-table th, .generated-table td").evaluateAll((cells) =>
    cells.map((cell) => cell.childNodes[0]?.textContent || ""),
  );
  assert.equal(text.every((value) => value === ""), true);
}

async function expectLargeGridResize(page) {
  await page.locator("#row-count").fill("45");
  await page.locator("#row-count").dispatchEvent("change");
  await page.locator("#col-count").fill("25");
  await page.locator("#col-count").dispatchEvent("change");
  await page.waitForFunction(() => document.querySelectorAll(".generated-table tr").length === 45);
  assert.equal(await page.locator(".generated-table tr").count(), 45);
  assert.equal(await page.locator(".generated-table col").count(), 25);

  await page.locator("#row-count").fill("5");
  await page.locator("#row-count").dispatchEvent("change");
  await page.locator("#col-count").fill("4");
  await page.locator("#col-count").dispatchEvent("change");
  await page.waitForFunction(() => document.querySelectorAll(".generated-table tr").length === 5);
}

async function expectMergeAndUnmerge(page) {
  await dragSelectCells(page, 0, 0, 1, 1);
  await page.locator('[data-action="merge"]').first().click();
  await page.waitForFunction(() => document.querySelector('[data-row="0"][data-col="0"]')?.colSpan === 2);
  const master = page.locator('[data-row="0"][data-col="0"]');
  assert.equal(await master.evaluate((cell) => cell.rowSpan), 2);
  assert.equal(await master.evaluate((cell) => cell.colSpan), 2);

  await page.locator('[data-action="unmerge"]').first().click();
  await page.waitForFunction(() => document.querySelector('[data-row="0"][data-col="0"]')?.colSpan === 1);
  assert.equal(await page.locator(".generated-table th, .generated-table td").count(), 20);
}

async function dragSelectCells(page, startRow, startCol, endRow, endCol) {
  const start = await page.locator(`[data-row="${startRow}"][data-col="${startCol}"]`).boundingBox();
  const end = await page.locator(`[data-row="${endRow}"][data-col="${endCol}"]`).boundingBox();
  assert.ok(start);
  assert.ok(end);
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 3 });
  await page.mouse.up();
  const expected = (Math.abs(endRow - startRow) + 1) * (Math.abs(endCol - startCol) + 1);
  await page.waitForFunction((count) => document.querySelectorAll(".range-cell").length >= count, expected);
}

async function expectDimensionDragAndRestore(page) {
  const widthBefore = await firstColumnWidth(page);
  await dragHandle(page, '[data-row="0"][data-col="0"] .col-resize-handle', 40, 0, { expectTooltip: true });
  const widthAfter = await firstColumnWidth(page);
  assert.equal(widthAfter > widthBefore, true);

  const heightBefore = await firstRowHeight(page);
  await dragHandle(page, '[data-row="0"][data-col="0"] .row-resize-handle', 0, 24, { expectTooltip: true });
  const heightAfter = await firstRowHeight(page);
  assert.equal(heightAfter > heightBefore, true);

  await page.waitForTimeout(250);
  await page.reload();
  await page.waitForSelector(".generated-table");
  assert.equal(await firstColumnWidth(page), widthAfter);
  assert.equal(await firstRowHeight(page), heightAfter);
}

async function expectImportAndPaste(page) {
  await page.locator("#paste-data").fill("A,B\nC,D");
  await page.locator('[data-action="import-data"]').click();
  await page.waitForFunction(() => document.querySelector("#grid-size")?.textContent === "2 x 2");
  assert.equal(await page.locator('[data-row="0"][data-col="0"]').textContent(), "A");
  assert.equal(await page.locator('[data-row="1"][data-col="1"]').textContent(), "D");

  await page.locator('[data-row="1"][data-col="1"]').click();
  await page.evaluate(() => {
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", {
      value: { getData: () => "E\tF\nG\tH" },
    });
    document.dispatchEvent(event);
  });
  await page.waitForFunction(() => document.querySelector("#grid-size")?.textContent === "3 x 3");
  assert.equal(await page.locator('[data-row="2"][data-col="2"]').textContent(), "H");
}

async function expectExportDrawer(page) {
  await page.locator('[data-action="open-export"]').click();
  await page.waitForSelector("#export-drawer.open");
  assert.match(await page.locator("#export-code").textContent(), /<colgroup>/);
  assert.match(await page.locator("#export-code").textContent(), /<tr style="height: \d+px;">/);
  assert.match(await page.locator("#export-code").textContent(), /class="htg-cell htg-style-1"/);

  await page.locator('[data-export-tab="css"]').click();
  assert.match(await page.locator("#export-code").textContent(), /\.htg-table/);
  assert.match(await page.locator("#export-code").textContent(), /\.htg-style-1/);
  await page.locator('[data-export-tab="full"]').click();
  assert.match(await page.locator("#export-code").textContent(), /<!doctype html>/);
  await page.locator('[data-action="copy-code"]').click();
  await page.waitForFunction(() => document.querySelector('[data-action="copy-code"]')?.textContent === "已复制");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector("#export-drawer")?.classList.contains("open"));
}

async function expectExportQuality(page) {
  await page.locator('[data-row="0"][data-col="0"]').click();
  await page.keyboard.type("Z");
  const closedCode = await page.locator("#export-code").textContent();
  assert.equal(closedCode.includes("Z"), false);

  await page.locator('[data-action="open-export"]').click();
  await page.waitForSelector("#export-drawer.open");
  await page.locator('[data-export-tab="html"]').click();
  const html = await page.locator("#export-code").textContent();
  assert.equal(html.includes("font-size:"), false);
  assert.match(html, /class="htg-cell htg-style-1"/);
  assert.match(await page.locator("#export-meta").textContent(), /HTML · \d+ 行/);
  assert.match(await page.locator("#export-hint").textContent(), /CSS/);

  await page.locator('[data-export-tab="css"]').click();
  const css = await page.locator("#export-code").textContent();
  assert.equal((css.match(/\.htg-style-/g) || []).length, 1);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector("#export-drawer")?.classList.contains("open"));
}

async function expectLargeTableInteractions(page) {
  await page.evaluate(() => {
    const rowCount = document.querySelector("#row-count");
    const colCount = document.querySelector("#col-count");
    rowCount.value = "100";
    rowCount.dispatchEvent(new Event("change", { bubbles: true }));
    colCount.value = "50";
    colCount.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(() => document.querySelector("#grid-size")?.textContent === "100 x 50");
  assert.equal(await page.locator(".generated-table col").count(), 50);

  await page.locator("#table-stage").evaluate((node) => {
    node.scrollLeft = 0;
    node.scrollTop = 0;
  });
  await page.locator('[data-row="0"][data-col="0"]').click();
  await page.waitForFunction(() => document.activeElement?.matches('[data-row="0"][data-col="0"]'));
  await page.keyboard.down("Shift");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.up("Shift");
  await dragHandle(page, '[data-row="0"][data-col="0"] .col-resize-handle', 20, 0, { expectTooltip: true });
  await page.locator('[data-action="zoom-in"]').click();
  await page.waitForFunction(() => document.querySelector("#zoom-value")?.textContent === "110%");
}

async function expectLegacyStorageMigration(page, baseUrl) {
  await page.goto(baseUrl);
  await page.evaluate((key) => {
    localStorage.setItem(key, JSON.stringify({
      rows: 1,
      cols: 1,
      caption: "legacy",
      table: {},
      cells: [[{ content: "old", style: { textAlign: "center" } }]],
    }));
  }, STORAGE_KEY);
  await page.reload();
  await page.waitForSelector(".generated-table");
  assert.equal(await page.locator('[data-row="0"][data-col="0"]').textContent(), "old");
  await page.waitForTimeout(250);
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  assert.equal(saved.schemaVersion, 1);
  assert.equal(saved.columnWidths.length, 1);
  assert.equal(saved.rowHeights.length, 1);
  assert.equal(saved.cells[0][0].style.fontSize, 14);
}

async function dragHandle(page, selector, deltaX, deltaY, options = {}) {
  const box = await page.locator(selector).boundingBox();
  assert.ok(box);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + deltaX, y + deltaY, { steps: 4 });
  if (options.expectTooltip) {
    await page.waitForFunction(() => !document.querySelector("#resize-tooltip")?.hidden);
    assert.match(await page.locator("#resize-tooltip").textContent(), /\d+px/);
  }
  await page.mouse.up();
  if (options.expectTooltip) {
    await page.waitForFunction(() => document.querySelector("#resize-tooltip")?.hidden);
  }
}

async function firstColumnWidth(page) {
  return page.locator(".generated-table col").first().evaluate((col) => Number.parseInt(col.style.width, 10));
}

async function firstRowHeight(page) {
  return page.locator(".generated-table tr").first().evaluate((row) => Number.parseInt(row.style.height, 10));
}

module.exports = { run };
