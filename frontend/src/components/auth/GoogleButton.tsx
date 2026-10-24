import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/context/ThemeContext';

/** The parts of Google Identity Services this button uses. */
interface GoogleIdentity {
  accounts: {
    id: {
      initialize(options: {
        client_id: string;
        callback: (response: { credential: string }) => void;
        ux_mode?: 'popup' | 'redirect';
        auto_select?: boolean;
        cancel_on_tap_outside?: boolean;
        context?: 'signin' | 'signup' | 'use';
      }): void;
      renderButton(parent: HTMLElement, options: Record<string, string | number>): void;
    };
  };
}

declare global {
  interface Window { google?: GoogleIdentity }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client';
let scriptLoad: Promise<void> | null = null;

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  scriptLoad ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { scriptLoad = null; reject(new Error('Google sign-in didn’t load')); };
    document.head.appendChild(s);
  });
  return scriptLoad;
}

// Google keeps one callback per page; it hands the credential to whichever button is showing
let initializedFor: string | null = null;
let deliver: (credential: string) => void = () => {};

/**
 * Google's own "Sign in with Google" button (Google Identity Services). After
 * the student picks an account, onCredential gets the ID token to send to
 * POST /api/auth/google. Matches the app's theme.
 */
export default function GoogleButton({ clientId, text, onCredential }: {
  clientId: string;
  text: 'signin_with' | 'signup_with' | 'continue_with';
  onCredential: (credential: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const { isDark } = useTheme();
  const [failed, setFailed] = useState(false);
  // Always the latest handler: it reads the form's current values (invite code, goal)
  useEffect(() => { deliver = onCredential; });

  useEffect(() => {
    let cancelled = false;
    loadGoogleScript().then(() => {
      const id = window.google?.accounts.id;
      if (cancelled || !box.current || !id) return;
      if (initializedFor !== clientId) {
        id.initialize({
          client_id: clientId,
          callback: (r) => deliver(r.credential),
          ux_mode: 'popup',
          auto_select: false,
          cancel_on_tap_outside: true,
          context: text === 'signup_with' ? 'signup' : 'signin',
        });
        initializedFor = clientId;
      }
      box.current.innerHTML = '';
      id.renderButton(box.current, {
        type: 'standard',
        theme: isDark ? 'filled_black' : 'outline',
        size: 'large',
        text,
        shape: 'rectangular',
        logo_alignment: 'left',
        width: Math.max(200, Math.min(400, box.current.clientWidth || 360)),
      });
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [clientId, text, isDark]);

  if (failed) {
    return <p className="text-center text-xs text-muted-foreground">Google sign-in couldn’t load here. Use your email instead.</p>;
  }
  // Reserve the button's height so the form doesn't jump when it appears
  return <div ref={box} className="flex min-h-10 w-full justify-center" />;
}
