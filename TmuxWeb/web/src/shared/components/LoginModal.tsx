import { useState, FormEvent } from 'react';
import { Terminal } from 'lucide-react';
import { login } from '../../utils/auth';
import './LoginModal.css';

interface Props {
  onLogin: () => void;
}

export function LoginModal({ onLogin }: Props) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const result = await login(token);
    setLoading(false);
    if (result.success) {
      onLogin();
    } else {
      setError(result.error || 'Login failed');
    }
  }

  return (
    <div className="login-overlay">
      <form className="login-modal" onSubmit={handleSubmit}>
        <div className="login-header">
          <div className="login-icon">
            <Terminal size={32} />
          </div>
          <h1>TmuxWeb</h1>
        </div>
        
        <div className="login-field">
          <label htmlFor="token">Access Token</label>
          <input
            id="token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Enter your token"
            autoFocus
            disabled={loading}
          />
        </div>

        {error && <div className="login-error">{error}</div>}

        <button type="submit" className="login-submit" disabled={loading || !token}>
          {loading ? 'Authenticating...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
