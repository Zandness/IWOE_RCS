import { saveAuditedWarehouse } from "./wmsAudit.js";
import { MONITOR_KEY, isReserved } from './basketStore.js';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = message => { throw new Error(message); };
const clone = value => JSON.parse(JSON.stringify(value));
function number(value) {
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '' || !Number.isFinite(Number(value)) || Number(value) < 0) fail('Enter a non-negative count for every item.');
  return Number(value);
}
export function validateStockCounts(counts) {
  if (counts == null) return;
  if (!Array.isArray(counts)) fail('Invalid stock count records.');
  const ids = new Set();
  for (const count of counts) {
    if (!object(count) || typeof count.id !== 'string' || !count.id || ids.has(count.id) || !['DRAFT', 'COMPLETED', 'CANCELLED'].includes(count.status) || !Array.isArray(count.lines) || !count.lines.length || typeof count.baseline !== 'string' || typeof count.operator !== 'string' || typeof count.reason !== 'string' || !Number.isFinite(Date.parse(count.createdAt))) fail('Invalid stock count record.');
    ids.add(count.id);
    for (const field of ['rackId', 'shelfId', 'loadId']) if (typeof count[field] !== 'string' || !count[field]) fail('Invalid stock count location or Load.');
    const itemIds = new Set();
    for (const line of count.lines) {
      if (!object(line) || !line.itemId || !line.sku || itemIds.has(line.itemId) || typeof line.before !== 'number' || typeof line.reserved !== 'number') fail('Invalid stock count line.');
      itemIds.add(line.itemId);
      number(line.before); number(line.reserved);
      if (line.reserved > line.before) fail('Invalid stock count reservation.');
      if (line.counted !== '') number(line.counted);
      if (count.status === 'COMPLETED' && (line.counted === '' || line.counted < line.reserved || line.difference !== Number(line.counted) - line.before)) fail('Invalid completed stock count.');
    }
    if (count.status === 'COMPLETED' && (!count.operator.trim() || !count.reason.trim() || !Number.isFinite(Date.parse(count.closedAt)))) fail('Incomplete stock count audit record.');
  }
}
export function readStockCountData(storage = localStorage) {
  const data = JSON.parse(storage.getItem(MONITOR_KEY) || 'null');
  if (!object(data) || !Array.isArray(data.racks) || data.racks.some(rack => !object(rack) || !Array.isArray(rack.shelves) || rack.shelves.some(shelf => !object(shelf) || !Array.isArray(shelf.inventory)))) fail('Invalid warehouse data. Open Monitor and check data consistency first.');
  if (data.history != null && !Array.isArray(data.history)) fail('Invalid warehouse history.');
  validateStockCounts(data.stockCounts);
  return data;
}
function locate(data, rackId, shelfId) {
  const racks = data.racks.filter(rack => rack.id === rackId);
  const shelves = data.racks.flatMap(rack => rack.shelves).filter(shelf => shelf.id === shelfId);
  if (racks.length !== 1 || shelves.length !== 1 || !racks[0].shelves.includes(shelves[0])) fail('Location is missing or duplicated. Check warehouse data.');
  return shelves[0];
}
function available(data, shelf, storage) {
  const queue = JSON.parse(storage.getItem('wms-robot-tasks-v1') || '[]');
  if (!Array.isArray(queue) || queue.some(task => !object(task))) fail('Invalid transfer queue.');
  if (isReserved(shelf.id, '', data, queue)) fail('This location is reserved by a transfer. Resolve the transfer before counting.');
  if (['BLOCKED', 'MAINTENANCE'].includes(shelf.status)) fail('This location is unavailable.');
  if (!shelf.basket?.id) fail('This location has no Load ID. Check data consistency first.');
  if (data.racks.flatMap(rack => rack.shelves).filter(point => point.basket?.id === shelf.basket.id).length !== 1) fail('Duplicate Load ID. Check data consistency first.');
}
function save(data, original, storage, audit = {}) {
  validateStockCounts(data.stockCounts);
  if (storage.getItem(MONITOR_KEY) !== original) fail('Warehouse data changed while saving. Reload and try again.');
  // Save stock and audit together with one atomic localStorage write.
  return saveAuditedWarehouse(data, { ...audit, expectedRaw: original }, storage);
}
export function startStockCount(rackId, shelfId, storage = localStorage) {
  const original = storage.getItem(MONITOR_KEY);
  const data = readStockCountData(storage);
  const shelf = locate(data, rackId, shelfId);
  available(data, shelf, storage);
  if (!shelf.inventory.length) fail('No inventory items to count at this location.');
  if ((data.stockCounts || []).some(count => count.status === 'DRAFT' && count.shelfId === shelfId)) fail('A draft count already exists here. Resume or cancel it first.');
  const ids = new Set();
  for (const item of shelf.inventory) {
    if (!object(item) || !item.id || !item.sku || ids.has(item.id)) fail('Invalid or duplicate inventory item.');
    ids.add(item.id);
    if (number(item.reserved ?? 0) > number(item.quantity)) fail('Reserved quantity exceeds stock. Review reservations first.');
  }
  const count = {
    id: `COUNT-${crypto.randomUUID()}`, status: 'DRAFT', createdAt: new Date().toISOString(),
    rackId, shelfId, locationCode: shelf.code || '', loadId: shelf.basket.id,
    baseline: JSON.stringify(shelf), operator: '', reason: '',
    lines: shelf.inventory.map(item => ({ itemId: item.id, sku: item.sku, name: item.name || '', unit: item.unit || '', before: Number(item.quantity), reserved: Number(item.reserved ?? 0), counted: '' })),
  };
  data.stockCounts = [count, ...(data.stockCounts || [])];
  save(data, original, storage);
  return count.id;
}
export function updateStockCount(id, input, action = 'SAVE', storage = localStorage) {
  if (!['SAVE', 'CONFIRM', 'CANCEL'].includes(action)) fail('Unknown stock count action.');
  const original = storage.getItem(MONITOR_KEY);
  const data = readStockCountData(storage);
  const matches = (data.stockCounts || []).filter(count => count.id === id);
  if (matches.length !== 1 || matches[0].status !== 'DRAFT') fail('This count is missing or already closed. Reload the page.');
  const count = matches[0];
  if (action === 'CANCEL') {
    count.status = 'CANCELLED'; count.closedAt = new Date().toISOString();
    return save(data, original, storage);
  }
  if (!Array.isArray(input.counted) || input.counted.length !== count.lines.length) fail('Count lines do not match.');
  count.operator = String(input.operator || '').trim();
  count.reason = String(input.reason || '').trim();
  count.lines = count.lines.map((line, index) => ({ ...line, counted: input.counted[index] === '' ? '' : number(input.counted[index]) }));
  count.updatedAt = new Date().toISOString();
  if (action === 'CONFIRM') {
    if (!count.operator || !count.reason) fail('Enter the counter name and reason before confirming.');
    const shelf = locate(data, count.rackId, count.shelfId);
    available(data, shelf, storage);
    if (JSON.stringify(shelf) !== count.baseline) fail('Location data changed since counting started. Cancel this count and start a new one.');
    if (shelf.inventory.length !== count.lines.length) fail('Inventory changed. Start a new count.');
    for (const [index, line] of count.lines.entries()) {
      const actual = number(line.counted), item = shelf.inventory[index];
      if (item.id !== line.itemId || item.sku !== line.sku || Number(item.quantity) !== line.before || Number(item.reserved ?? 0) !== line.reserved) fail('Inventory changed. Start a new count.');
      if (actual < line.reserved) fail(`${line.sku}: Count is below reserved quantity ${line.reserved}. Review reservations first.`);
      item.quantity = actual;
      line.difference = actual - line.before;
    }
    count.status = 'COMPLETED'; count.closedAt = new Date().toISOString();
    // Retain zero-stock items and their Load; counting never deletes records.
    data.history = [{ id: `HIS-${crypto.randomUUID()}`, type: 'STOCK_COUNT', countId: count.id, rackId: count.rackId, shelfId: count.shelfId, locationCode: count.locationCode, basketId: count.loadId, operator: count.operator, reason: count.reason, lines: clone(count.lines), createdAt: count.closedAt }, ...(data.history || [])];
  }
  return save(data, original, storage, { actor: count.operator, reason: count.reason, action: 'STOCK_COUNT' });
}