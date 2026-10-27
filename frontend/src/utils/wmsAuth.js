let currentUser = null;
const baseUrl = String(import.meta.env?.VITE_RCS_BRIDGE_URL || '').trim().replace(/\/+$/, '');
export function authenticatedUser() { return currentUser; }
export function setAuthenticatedUser(user) {
  currentUser = user || null;
  globalThis.window?.dispatchEvent(new CustomEvent('wms-auth-changed', { detail: currentUser }));
}
export async function authRequest(path, { method = 'GET', body } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${baseUrl}/api/wms/auth/${path}`, { method, credentials: 'include', cache: 'no-store', signal: controller.signal, headers: { 'Content-Type': 'application/json', 'X-WMS-Request': '1' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await response.json();
    if (!response.ok) { if (response.status === 401 && path === 'authorize') setAuthenticatedUser(null); const error = new Error(typeof data.detail === 'string' ? data.detail : `Account request failed (HTTP ${response.status}).`); error.status = response.status; throw error; }
    return data;
  } finally { clearTimeout(timer); }
}
