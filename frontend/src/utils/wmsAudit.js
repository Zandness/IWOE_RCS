import { persistWarehouseData } from "./browserSession.js";
export const AUDIT_MONITOR_KEY = 'wms-monitor-master-v2';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const clone = value => JSON.parse(JSON.stringify(value));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function requireValue(ok, message) { if (!ok) throw new Error(message); }
export function validateAuditLog(log) {
  if (log == null) return;
  requireValue(Array.isArray(log), 'Invalid audit history.');
  const ids = new Set();
  for (const record of log) {
    requireValue(object(record) && typeof record.id === 'string' && record.id && !ids.has(record.id) && typeof record.actor === 'string' && record.actor.trim() && typeof record.reason === 'string' && record.reason.trim() && typeof record.action === 'string' && record.action && Number.isFinite(Date.parse(record.createdAt)) && Array.isArray(record.changes) && record.changes.length > 0, 'Invalid audit record.');
    ids.add(record.id);
    requireValue(record.changes.every(change => object(change) && typeof change.entity === 'string' && typeof change.position === 'string' && Object.hasOwn(change, 'before') && Object.hasOwn(change, 'after')), 'Invalid audit changes.');
  }
}
function entities(data) {
  const result = new Map();
  function add(key, entity, position, value) {
    requireValue(!result.has(key), `Duplicate data identity at ${position}. Check data consistency first.`);
    result.set(key, { entity, position, value });
  }
  requireValue(Array.isArray(data.racks), 'Invalid storage data.');
  for (const rack of data.racks) {
    requireValue(object(rack) && Array.isArray(rack.shelves), 'Invalid storage data.');
    const { shelves, ...settings } = rack;
    add(JSON.stringify(['rack', rack.id]), 'STORAGE', String(rack.id), settings);
    for (const shelf of shelves) {
      requireValue(object(shelf) && Array.isArray(shelf.inventory), 'Invalid inventory data.');
      const { inventory, ...location } = shelf;
      const position = `${rack.id} / ${shelf.code || '(No Code)'} [${shelf.id}]`;
      add(JSON.stringify(['location', shelf.id]), 'LOCATION', position, location);
      for (const item of inventory) {
        requireValue(object(item), 'Invalid inventory item.');
        add(JSON.stringify(['item', shelf.id, item.id]), 'INVENTORY', `${position} / ${item.sku} [${item.id}]`, item);
      }
    }
  }
  for (const [field, entity, idField] of [['skuCatalog', 'SKU_MASTER', 'sku'], ['outboundOperations', 'OUTBOUND_OPERATION', 'id'], ['documents', 'WAREHOUSE_DOCUMENT', 'id']]) {
    requireValue(data[field] == null || Array.isArray(data[field]), `Invalid ${field}.`);
    for (const item of data[field] || []) {
      requireValue(object(item), `Invalid ${field} record.`);
      add(JSON.stringify([field, item[idField]]), entity, `${entity} / ${item[idField]}`, item);
    }
  }
  return result;
}
export function buildAuditChanges(before, after) {
  const previous = entities(before), current = entities(after), changes = [];
  for (const key of new Set([...previous.keys(), ...current.keys()])) {
    const old = previous.get(key), next = current.get(key);
    if (!same(old?.value ?? null, next?.value ?? null)) {
      changes.push({ entity: (next || old).entity, position: (next || old).position, previousPosition: old?.position || '', before: clone(old?.value ?? null), after: clone(next?.value ?? null) });
    }
  }
  return changes;
}
export function saveAuditedWarehouse(next, { actor, reason, action = 'WMS_UPDATE', expectedRaw } = {}, storage = localStorage) {
  const raw = storage.getItem(AUDIT_MONITOR_KEY);
  requireValue(raw !== null && (expectedRaw === undefined || raw === expectedRaw), 'Warehouse data changed. Reload before saving.');
  const before = JSON.parse(raw);
  validateAuditLog(before.auditLog);
  requireValue(same(next.auditLog ?? [], before.auditLog ?? []), 'Audit history changed. Reload before saving.');
  const changes = buildAuditChanges(before, next);
  const data = clone(next);
  data.auditLog = clone(before.auditLog || []);
  if (changes.length) {
    const name = String(actor || '').trim(), note = String(reason || '').trim();
    requireValue(name && note, 'Enter the operator name and reason before saving warehouse changes.');
    data.auditLog.unshift({ id: `AUDIT-${crypto.randomUUID()}`, createdAt: new Date().toISOString(), actor: name, reason: note, action, changes });
  }
  validateAuditLog(data.auditLog);
  requireValue(storage.getItem(AUDIT_MONITOR_KEY) === raw, 'Warehouse data changed while saving. Reload and try again.');
  // The change and its audit record are saved together; a quota failure saves neither.
  return persistWarehouseData(data, raw, storage);
}
