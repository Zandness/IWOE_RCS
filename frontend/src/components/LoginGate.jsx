import { useEffect, useRef, useState } from 'react';
import LoginForm from './LoginForm';
import { authenticatedUser, authRequest, setAuthenticatedUser } from '../utils/wmsAuth';
import { configureBrowserSession, setAccountConnection } from '../utils/browserSession';
import { prepareBrowserWarehouse } from '../utils/browserMigration';
import '../styles/OverviewSettings.css';

export default function LoginGate({ children }) {
  const [session, setSession] = useState({ checked: false, needs_setup: false, user: null, online: false });
  const [error, setError] = useState(''), [migration, setMigration] = useState('');
  const generation = useRef(0), migrationReady = useRef(false);
  async function refresh() {
    if (!migrationReady.current) {
      try { const result = prepareBrowserWarehouse(); migrationReady.current = true; if (result.recoveredPrevious) setMigration('The current cache was empty. Your preserved Browser warehouse was recovered; Backend warehouse data was not changed.'); }
      catch (error) { setError(error.message); return; }
    }
    const request = ++generation.current;
    try {
      const data = await authRequest('status');
      if (request !== generation.current) return;
      setAccountConnection(true); setAuthenticatedUser(data.user);
      setSession({ ...data, checked: true, online: true }); setError('');
    } catch (error) {
      if (request !== generation.current) return;
      setAccountConnection(false); setSession(value => ({ ...value, online: false })); setError(error.message);
    }
  }
  useEffect(() => {
    configureBrowserSession(true);
    try {
      const result = prepareBrowserWarehouse(); migrationReady.current = true;
      if (result.recoveredPrevious) setMigration('The current cache was empty. Your preserved Browser warehouse was recovered; Backend warehouse data was not changed.');
    } catch (error) { setError(error.message); return; }
    refresh();
    const changed = event => { if (!event.detail) generation.current++; setSession(value => ({ ...value, user: event.detail, checked: true })); };
    const focus = () => refresh();
    window.addEventListener('wms-auth-changed', changed); window.addEventListener('focus', focus);
    const timer = window.setInterval(refresh, 30000);
    return () => { generation.current++; window.clearInterval(timer); window.removeEventListener('wms-auth-changed', changed); window.removeEventListener('focus', focus); };
  }, []);
  async function signedIn(user) {
    generation.current++; setAccountConnection(true); setAuthenticatedUser(user);
    setSession({ checked: true, needs_setup: false, user, online: true }); setError('');
  }
  async function signOut() {
    generation.current++;
    try { await authRequest('logout', { method: 'POST' }); setAuthenticatedUser(null); setSession(value => ({ ...value, user: null })); setError(''); }
    catch (error) { setError(error.message); }
  }
  if (!session.user) return <main className="page wms-overview">
    {session.checked ? <LoginForm needsSetup={session.needs_setup} onSignedIn={signedIn} /> : <section className="panel overview-section"><h2>WMS sign in</h2><p>Connecting to the account server…</p></section>}
    {(error || migration) && <section className="panel overview-section">{error && <p role="alert">{error}</p>}{migration && <p>{migration}</p>}<div className="overview-actions"><button type="button" className="settings-secondary" onClick={refresh}>Reconnect</button></div></section>}
  </main>;
  return <div key={session.user.id}>
    <div className="account-banner" role="status">{session.user.username} · {session.user.role} · Warehouse storage: this Browser · {session.online ? session.user.role === 'viewer' ? 'Read-only access' : 'Editing enabled' : 'Account server unavailable — saves and dispatch paused'} <button type="button" onClick={signOut}>Sign out</button>{!session.online && <button type="button" onClick={refresh}>Reconnect</button>}{error && <span> · {error}</span>}</div>
    {migration && <p className="overview-notice">{migration}</p>}
    {typeof children === 'function' ? children() : children}
  </div>;
}
