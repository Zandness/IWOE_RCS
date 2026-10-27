import { authenticatedUser, authRequest, setAuthenticatedUser } from './wmsAuth.js';
let enabled = false;
let connected = false;
export function configureBrowserSession(value) { enabled = value; }
export function setAccountConnection(value) { connected = value; }
export function canEditWarehouse() { return !enabled || (connected && ['operator', 'admin'].includes(authenticatedUser()?.role)); }
export function requireWarehouseWrite() { if (!canEditWarehouse()) throw new Error('An online Operator or Admin account is required for this action.'); }
export function afterWarehouseSave(result, callback) { return result && typeof result.then === 'function' ? result.then(callback) : callback(result); }
export function withLocalWritePermission(storage, callback) {
  if (!enabled || storage !== globalThis.localStorage) return callback(null);
  requireWarehouseWrite();
  const identity = authenticatedUser()?.id;
  return authRequest('authorize', { method: 'POST' }).then(result => {
    const commit = () => {
      if (identity !== result.user?.id || identity !== authenticatedUser()?.id) { if (authenticatedUser()) setAuthenticatedUser(null); throw new Error('The signed-in account changed. Reload before saving.'); }
      return callback(result);
    };
    return globalThis.navigator?.locks?.request ? navigator.locks.request('wms-browser-warehouse-write', async () => commit()) : commit();
  });
}
export function persistWarehouseData(data, original, storage = localStorage) {
  return withLocalWritePermission(storage, authorization => {
    if (storage.getItem('wms-monitor-master-v2') !== original) throw new Error('Warehouse data changed while checking your account. Reload before saving.');
    if (authorization) {
      const before = JSON.parse(original || '{}').auditLog || [];
      for (const record of (data.auditLog || []).slice(0, (data.auditLog || []).length - before.length)) {
        record.enteredActor = record.actor;
        record.actor = authorization.user.username;
        record.actorId = authorization.user.id;
        record.actorRole = authorization.user.role;
        record.createdAt = new Date(authorization.authorized_at * 1000).toISOString();
      }
    }
    storage.setItem('wms-monitor-master-v2', JSON.stringify(data));
    return data;
  });
}
