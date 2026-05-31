import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_COLS,
  DEFAULT_COLUMN_WIDTH,
  DEFAULT_ROW_HEIGHT,
  DEFAULT_ROWS,
  STORAGE_KEY,
  defaultCellStyle,
} from "./config.js";

export const appState = {
  data: null,
  selection: { anchor: { row: 0, col: 0 }, cells: [{ row: 0, col: 0 }] },
  history: [],
  future: [],
  exportTab: "html",
  editingPos: null,
  editingOriginal: "",
  dragAnchor: null,
  saveTimer: 0,
  toastTimer: 0,
  ui: {
    exportDrawerOpen: false,
    zoom: 1,
    isPanning: false,
    panStartX: 0,
    panStartY: 0,
    panScrollLeft: 0,
    panScrollTop: 0,
    resize: null,
  },
};

export function initState() {
  appState.data = migrateState(loadState() || createInitialState());
}

export function snapshot() {
  return JSON.stringify(appState.data);
}

export function commit() {
  const current = snapshot();
  if (appState.history[appState.history.length - 1] !== current) {
    appState.history.push(current);
  }
  if (appState.history.length > 80) appState.history.shift();
  appState.future = [];
}

export function restore(data) {
  appState.data = migrateState(JSON.parse(data));
  appState.editingPos = null;
  appState.editingOriginal = "";
}

export function undo() {
  if (!appState.history.length) return false;
  appState.future.push(snapshot());
  restore(appState.history.pop());
  return true;
}

export function migrateState(data) {
  const version = Number(data.schemaVersion || 0);
  if (version < 1) migrateV0ToV1(data);
  data.schemaVersion = CURRENT_SCHEMA_VERSION;
  return data;
}

function migrateV0ToV1(data) {
  data.caption ??= "";
  data.rows = Math.max(1, Math.floor(Number(data.rows) || data.cells?.length || DEFAULT_ROWS));
  data.cols = Math.max(1, Math.floor(Number(data.cols) || data.cells?.[0]?.length || DEFAULT_COLS));
  data.table ??= {};
  data.table.width ??= data.cols * DEFAULT_COLUMN_WIDTH;
  data.table.theme ??= "clean";
  data.table.zebra ??= false;
  data.table.sticky ??= false;
  data.columnWidths = normalizeSizeArray(data.columnWidths, data.cols, DEFAULT_COLUMN_WIDTH);
  data.rowHeights = normalizeSizeArray(data.rowHeights, data.rows, DEFAULT_ROW_HEIGHT);
  data.cells = normalizeCells(data.cells, data.rows, data.cols);
}

function normalizeCells(cells, rows, cols) {
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => normalizeCell(cells?.[row]?.[col])),
  );
}

function normalizeCell(cell) {
  return {
    id: cell?.id || crypto.randomUUID(),
    content: cell?.content ?? "",
    rowSpan: Math.max(1, Math.floor(Number(cell?.rowSpan) || 1)),
    colSpan: Math.max(1, Math.floor(Number(cell?.colSpan) || 1)),
    hidden: Boolean(cell?.hidden),
    style: { ...defaultCellStyle, ...(cell?.style || {}) },
  };
}

function normalizeSizeArray(values, length, fallback) {
  const result = Array.isArray(values) ? values.slice(0, length) : [];
  while (result.length < length) result.push(fallback);
  return result.map((value) => Number(value) > 0 ? Number(value) : fallback);
}

function createInitialState() {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    rows: DEFAULT_ROWS,
    cols: DEFAULT_COLS,
    caption: "",
    table: {
      width: DEFAULT_COLS * DEFAULT_COLUMN_WIDTH,
      theme: "clean",
      zebra: false,
      sticky: false,
    },
    columnWidths: Array.from({ length: DEFAULT_COLS }, () => DEFAULT_COLUMN_WIDTH),
    rowHeights: Array.from({ length: DEFAULT_ROWS }, () => DEFAULT_ROW_HEIGHT),
    cells: Array.from({ length: DEFAULT_ROWS }, () =>
      Array.from({ length: DEFAULT_COLS }, () => ({
        id: crypto.randomUUID(),
        content: "",
        rowSpan: 1,
        colSpan: 1,
        hidden: false,
        style: { ...defaultCellStyle },
      })),
    ),
  };
}

export function redo() {
  if (!appState.future.length) return false;
  appState.history.push(snapshot());
  restore(appState.future.pop());
  return true;
}

export function saveState(onSaving, onSaved) {
  window.clearTimeout(appState.saveTimer);
  onSaving?.();
  appState.saveTimer = window.setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState.data));
    onSaved?.();
  }, 180);
}

export function clearSavedState() {
  localStorage.removeItem(STORAGE_KEY);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.cells?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}
