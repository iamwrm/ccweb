import { useState, type FormEvent } from 'react';
import { authenticate } from '../lib/api';
import './LoginPage.css';

interface LoginPageProps {
  onSuccess: () => void;
}

export function LoginPage({ onSuccess }: LoginPageProps) {
  const [token, setToken] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(false);
    setLoading(true);
    try {
      await authenticate(token);
      onSuccess();
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-overlay">
      <form className="login-form" onSubmit={handleSubmit}>
        <h2 className="login-title">ccweb</h2>
        <p className="login-subtitle">Enter your access token to continue.</p>
        <input
          className="login-input"
          type="password"
          value={token}
          onChange={e => setToken(e.target.value)}
          placeholder="Access token"
          autoFocus
          autoComplete="off"
        />
        <button className="login-button" type="submit" disabled={loading || !token}>
          {loading ? 'Authenticating...' : 'Login'}
        </button>
        {error && <div className="login-error">Invalid token</div>}
      </form>
    </div>
  );
}
