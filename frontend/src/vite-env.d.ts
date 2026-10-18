/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API origin given to the browser extension when it differs from the app's (optional). */
  readonly VITE_API_ORIGIN?: string;
}
