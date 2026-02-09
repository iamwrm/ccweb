import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { LoginPage } from './components/LoginPage';
import { checkAuthStatus } from './lib/api';
import './global.css';

function AuthGate() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    checkAuthStatus().then(setAuthed);
  }, []);

  if (authed === null) return null; // loading
  if (!authed) return <LoginPage onSuccess={() => setAuthed(true)} />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthGate />
  </React.StrictMode>
);
