import { useEffect, useState } from 'react';
import { authenticatedUser, authRequest, setAuthenticatedUser } from '../utils/wmsAuth';


const emptyUser = { username: '', display_name: '', password: '', role: 'viewer' };
export default function AccountPanel() {
  const user = authenticatedUser();
  const [users, setUsers] = useState([]), [drafts, setDrafts] = useState({});
  const [draft, setDraft] = useState(emptyUser), [passwords, setPasswords] = useState({ current_password: '', new_password: '' });
  const [notice, setNotice] = useState(null), [busy, setBusy] = useState(false);
  const admin = user?.role === 'admin';
  async function load() {
    try { const result = await authRequest('users'); setUsers(result.users); setDrafts(Object.fromEntries(result.users.map(value => [value.id, { role: value.role, enabled: !!value.enabled, password: '' }]))); }
    catch (error) { setNotice({ error: true, text: error.message }); }
  }
  useEffect(() => { if (admin) load(); }, [admin]);
  async function create(event) {
    event.preventDefault(); setBusy(true);
    try { await authRequest('users', { method: 'POST', body: draft }); setDraft(emptyUser); await load(); setNotice({ text: 'User created. Share the account details with its owner securely.' }); }
    catch (error) { setNotice({ error: true, text: error.message }); }
    finally { setBusy(false); }
  }
  async function update(value) {
    const edit = drafts[value.id];
    if (!window.confirm(`Update ${value.username}? Existing sessions for this user will be signed out.`)) return;
    setBusy(true);
    try {
      await authRequest(`users/${value.id}`, { method: 'PATCH', body: { role: edit.role, enabled: edit.enabled, ...(edit.password ? { password: edit.password } : {}) } });
      if (value.id === user.id) { setAuthenticatedUser(null); return; }
      await load(); setNotice({ text: 'User updated. Existing sessions were revoked.' });
    } catch (error) { setNotice({ error: true, text: error.message }); }
    finally { setBusy(false); }
  }
  async function changePassword(event) {
    event.preventDefault(); setBusy(true);
    try { const result = await authRequest('password', { method: 'POST', body: passwords }); setPasswords({ current_password: '', new_password: '' }); setAuthenticatedUser(result.user); setNotice({ text: 'Password changed. Other sessions were signed out.' }); }
    catch (error) { setNotice({ error: true, text: error.message }); }
    finally { setBusy(false); }
  }
  if (!user) return null;
  return <section className="panel overview-section account-panel"><h3>WMS account</h3><p>Signed in as {user.username} · {user.display_name} · Role: {user.role}</p><p>Viewer: read and export. Operator: save WMS work. Admin: manage users. Account and RCS permissions are enforced by the Backend. Warehouse data stays in Local Storage; someone with device access can edit it outside this app.</p>
    <details><summary>Change my password</summary><form onSubmit={changePassword}><div className="overview-form"><label>Current password<input required type="password" autoComplete="current-password" value={passwords.current_password} onChange={event => setPasswords({ ...passwords, current_password: event.target.value })} /></label><label>New password<input required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={passwords.new_password} onChange={event => setPasswords({ ...passwords, new_password: event.target.value })} /></label></div><div className="overview-actions"><button type="submit" className="primary-button" disabled={busy}>Change password</button></div></form></details>
    {admin && <>
      <h3>User management</h3><p>Disabling, changing a role or resetting a password signs out that user’s existing sessions. The last enabled Admin cannot be disabled or demoted.</p>
      <form onSubmit={create}><h4>Create user</h4><div className="overview-form"><label>New username<input required minLength={3} maxLength={64} autoComplete="off" value={draft.username} onChange={event => setDraft({ ...draft, username: event.target.value })} /></label><label>Display name<input required maxLength={100} value={draft.display_name} onChange={event => setDraft({ ...draft, display_name: event.target.value })} /></label><label>Initial password<input required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={draft.password} onChange={event => setDraft({ ...draft, password: event.target.value })} /></label><label>Role<select value={draft.role} onChange={event => setDraft({ ...draft, role: event.target.value })}>{['viewer', 'operator', 'admin'].map(role => <option key={role} value={role}>{role}</option>)}</select></label></div><div className="overview-actions"><button type="submit" className="primary-button" disabled={busy}>Create user</button></div></form>
      <div style={{ overflowX: 'auto' }}><table className="consistency-table"><thead><tr><th>Username / Name</th><th>Role</th><th>Enabled</th><th>Reset password (optional)</th><th>Action</th></tr></thead><tbody>{users.map(value => <tr key={value.id}><td>{value.username}<br />{value.display_name}</td><td><select aria-label={`Role for ${value.username}`} value={drafts[value.id]?.role || value.role} onChange={event => setDrafts({ ...drafts, [value.id]: { ...drafts[value.id], role: event.target.value } })}>{['viewer', 'operator', 'admin'].map(role => <option key={role}>{role}</option>)}</select></td><td><input aria-label={`Enabled for ${value.username}`} type="checkbox" checked={drafts[value.id]?.enabled ?? !!value.enabled} onChange={event => setDrafts({ ...drafts, [value.id]: { ...drafts[value.id], enabled: event.target.checked } })} /></td><td><input aria-label={`Reset password for ${value.username}`} type="password" autoComplete="new-password" maxLength={128} value={drafts[value.id]?.password || ''} onChange={event => setDrafts({ ...drafts, [value.id]: { ...drafts[value.id], password: event.target.value } })} /></td><td><button type="button" disabled={busy} onClick={() => update(value)}>Save user</button></td></tr>)}</tbody></table></div>
    </>}
    {notice && <p role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
  </section>;
}
