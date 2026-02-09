import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import type { IncomingMessage } from 'http';

export interface AuthConfig {
  token: string;
  cookieName: string;
  cookieMaxAge: number;
}

export function createAuthConfig(cliToken?: string, envToken?: string): AuthConfig {
  const token = cliToken || envToken || crypto.randomBytes(32).toString('hex');
  return {
    token,
    cookieName: 'ccweb-auth',
    cookieMaxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };
}

export function signToken(token: string): string {
  return crypto.createHmac('sha256', token).update(token).digest('hex');
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  cookieHeader.split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      const name = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      cookies[name] = value;
    }
  });
  return cookies;
}

function setCookieHeader(name: string, value: string, maxAge: number): string {
  return `${name}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(maxAge / 1000)}`;
}

export function createAuthMiddleware(config: AuthConfig) {
  const signature = signToken(config.token);

  return (req: Request, res: Response, next: NextFunction) => {
    // Check query param (first visit with token link)
    const queryToken = req.query.token as string | undefined;
    if (queryToken === config.token) {
      res.setHeader('Set-Cookie', setCookieHeader(config.cookieName, signature, config.cookieMaxAge));
      // Redirect to strip token from URL
      const url = new URL(req.originalUrl, `http://${req.headers.host}`);
      url.searchParams.delete('token');
      const redirect = url.pathname + (url.search || '');
      res.redirect(redirect || '/');
      return;
    }

    // Check cookie
    const cookies = parseCookies(req.headers.cookie || '');
    if (cookies[config.cookieName] === signature) {
      next();
      return;
    }

    // Not authenticated
    if (req.path.startsWith('/api/')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Serve login page for HTML requests
    res.status(401).type('html').send(getLoginPage());
  };
}

export function validateWebSocketToken(config: AuthConfig, req: IncomingMessage): boolean {
  const signature = signToken(config.token);

  // Check cookie from upgrade request
  const cookies = parseCookies(req.headers.cookie || '');
  if (cookies[config.cookieName] === signature) {
    return true;
  }

  // Check query param as fallback
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  return url.searchParams.get('token') === config.token;
}

function getLoginPage(): string {
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ccweb - Login</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', system-ui, sans-serif; background: #0a0a0a; color: #ededed; display: flex; align-items: center; justify-content: center; height: 100vh; }
  .login { background: #111; padding: 32px; border-radius: 8px; border: 1px solid #222; width: 380px; }
  .login h2 { font-size: 18px; margin-bottom: 8px; color: #f6821f; font-weight: 600; }
  .login p { font-size: 13px; color: #888; margin-bottom: 20px; }
  .login input { width: 100%; background: #181818; border: 1px solid #333; color: #ededed; padding: 10px 12px; border-radius: 4px; font-size: 14px; font-family: 'IBM Plex Mono', monospace; outline: none; }
  .login input:focus { border-color: #f6821f; }
  .login button { width: 100%; background: #f6821f; color: white; border: none; padding: 10px 16px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500; margin-top: 12px; }
  .login button:hover { background: #ff9a3e; }
  .error { color: #e5484d; font-size: 12px; margin-top: 8px; display: none; }
</style>
</head><body>
<div class="login">
  <h2>ccweb</h2>
  <p>Enter your access token to continue.</p>
  <form id="f">
    <input name="token" type="password" placeholder="Access token" autofocus autocomplete="off" />
    <button type="submit">Login</button>
    <div class="error" id="err">Invalid token</div>
  </form>
</div>
<script>
document.getElementById('f').addEventListener('submit', async function(e) {
  e.preventDefault();
  var token = this.token.value;
  try {
    var res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token })
    });
    if (res.ok) {
      window.location.reload();
    } else {
      document.getElementById('err').style.display = 'block';
    }
  } catch (err) {
    document.getElementById('err').style.display = 'block';
  }
});
</script>
</body></html>`;
}
