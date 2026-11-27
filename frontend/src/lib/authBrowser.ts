import { supabase } from './supabase';

export interface AuthTokens {
  accessToken?: string;
  refreshToken?: string;
  user?: any;
  code?: string;
  error?: string;
}

/**
 * Checks whether the application is running in a native wrapper (Android / Tauri).
 */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as any;
  if (win.AndroidApp || win.__TAURI_INTERNALS__ || win.__TAURI__) return true;
  // Also check URL flag ?mode=native or ?source=app
  if (typeof window.location !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'native') return true;
  }
  return false;
}

/**
 * Resolves the URL of the hosted authentication website.
 */
export function getAuthWebUrl(): string {
  // 1. Explicitly configured web auth URL in environment
  if (import.meta.env.VITE_AUTH_WEB_URL) {
    return import.meta.env.VITE_AUTH_WEB_URL;
  }

  // 2. If running on a web origin that is NOT tauri:// or file:// or localhost inside WebView
  if (
    typeof window !== 'undefined' &&
    window.location &&
    (window.location.protocol === 'https:' || (window.location.protocol === 'http:' && !isNativeApp()))
  ) {
    return window.location.origin;
  }

  // 3. Fallback: use local dev server via ADB reverse (tcp:5173), or current origin
  return "http://localhost:5173";
}

/**
 * Launches the device's default system browser (Chrome, Edge, etc.)
 * navigating to the hosted ChatPilot AI authentication page.
 */
export function openAuthInSystemBrowser(hostedAuthUrl?: string): void {
  const baseUrl = hostedAuthUrl || getAuthWebUrl();
  const sep = baseUrl.includes('?') ? '&' : '?';
  const targetUrl = `${baseUrl}${sep}return_to=chatpilot://auth&source=app`;

  console.log('[AuthBrowser] Opening system browser to:', targetUrl);

  const win = window as any;

  // 1. Native Android JavascriptInterface (forces launch into system browser Intent)
  if (win.AndroidApp?.openBrowser) {
    try {
      win.AndroidApp.openBrowser(targetUrl);
      return;
    } catch (e) {
      console.error('[AuthBrowser] AndroidApp.openBrowser error:', e);
    }
  }

  // 2. Standard browser window.open
  try {
    const opened = window.open(targetUrl, '_blank');
    if (!opened) {
      window.location.href = targetUrl;
    }
  } catch (e) {
    window.location.href = targetUrl;
  }
}

/**
 * Parses deep link callback URLs (chatpilot://auth#... or chatpilot://auth?...)
 */
export function parseAuthCallbackUrl(url: string): AuthTokens {
  try {
    const hashIndex = url.indexOf('#');
    const queryIndex = url.indexOf('?');

    let params: URLSearchParams;
    if (hashIndex !== -1) {
      params = new URLSearchParams(url.substring(hashIndex + 1));
    } else if (queryIndex !== -1) {
      params = new URLSearchParams(url.substring(queryIndex + 1));
    } else {
      params = new URLSearchParams();
    }

    const accessToken = params.get('access_token') || params.get('token') || undefined;
    const refreshToken = params.get('refresh_token') || undefined;
    const code = params.get('code') || undefined;
    const error = params.get('error_description') || params.get('error') || undefined;

    let user: any = undefined;
    const userStr = params.get('user');
    if (userStr) {
      try {
        user = JSON.parse(decodeURIComponent(userStr));
      } catch {}
    }

    return { accessToken, refreshToken, user, code, error };
  } catch (e: any) {
    return { error: e.message || 'Invalid callback URL' };
  }
}

/**
 * Restores session from parsed callback tokens or PKCE code.
 */
export async function exchangeAndRestoreSession(
  urlOrTokens: string | AuthTokens,
  onAuthenticated: (user: any) => void
): Promise<boolean> {
  const tokens = typeof urlOrTokens === 'string' ? parseAuthCallbackUrl(urlOrTokens) : urlOrTokens;

  if (tokens.error) {
    console.error('[AuthBrowser] Callback error:', tokens.error);
    return false;
  }

  try {
    // A: Implicit token payload
    if (tokens.accessToken) {
      const { data, error } = await supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken || '',
      });

      if (error) {
        console.error('[AuthBrowser] Supabase setSession error:', error);
      }

      // Fetch user details
      const userRes = await supabase.auth.getUser();
      const user = userRes.data?.user || tokens.user;

      if (user) {
        const formattedUser = {
          id: user.id,
          email: user.email,
          name:
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email?.split('@')[0] ||
            'Thoufikur',
        };

        localStorage.setItem('chatpilot_access_token', tokens.accessToken);
        if (tokens.refreshToken) {
          localStorage.setItem('chatpilot_refresh_token', tokens.refreshToken);
        }
        localStorage.setItem('chatpilot_user', JSON.stringify(formattedUser));

        onAuthenticated(formattedUser);
        return true;
      }
    }

    // B: PKCE authorization code exchange
    if (tokens.code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(tokens.code);
      if (error) {
        console.error('[AuthBrowser] PKCE exchangeCodeForSession error:', error);
        return false;
      }

      if (data?.session && data?.user) {
        const formattedUser = {
          id: data.user.id,
          email: data.user.email,
          name:
            data.user.user_metadata?.full_name ||
            data.user.user_metadata?.name ||
            data.user.email?.split('@')[0] ||
            'Thoufikur',
        };

        localStorage.setItem('chatpilot_access_token', data.session.access_token);
        localStorage.setItem('chatpilot_refresh_token', data.session.refresh_token);
        localStorage.setItem('chatpilot_user', JSON.stringify(formattedUser));

        onAuthenticated(formattedUser);
        return true;
      }
    }
  } catch (e) {
    console.error('[AuthBrowser] Session restoration failed:', e);
  }

  return false;
}

/**
 * Initializes deep link listener on native Android / Windows.
 */
export function initDeepLinkListener(onAuthenticated: (user: any) => void): () => void {
  const handleCallbackEvent = async (e: any) => {
    const rawUrl = e.detail?.url;
    if (rawUrl) {
      console.log('[AuthBrowser] Received deep link callback:', rawUrl);
      await exchangeAndRestoreSession(rawUrl, onAuthenticated);
    }
  };

  window.addEventListener('chatpilot:auth_callback', handleCallbackEvent);

  // Check on cold start if Android passed a pending intent
  const win = window as any;
  if (win.AndroidApp?.getPendingAuthUrl) {
    try {
      const pending = win.AndroidApp.getPendingAuthUrl();
      if (pending && pending.startsWith('chatpilot://auth')) {
        console.log('[AuthBrowser] Processing cold-start pending auth URL:', pending);
        exchangeAndRestoreSession(pending, onAuthenticated);
      }
    } catch (e) {
      console.warn('[AuthBrowser] Cold start check note:', e);
    }
  }

  // Also check window.location for hash/query tokens if opened via web redirect
  if (typeof window !== 'undefined' && window.location) {
    const hash = window.location.hash;
    const search = window.location.search;
    if (hash.includes('access_token=') || search.includes('code=')) {
      const fullUrl = window.location.href;
      exchangeAndRestoreSession(fullUrl, onAuthenticated);
    }
  }

  return () => {
    window.removeEventListener('chatpilot:auth_callback', handleCallbackEvent);
  };
}
