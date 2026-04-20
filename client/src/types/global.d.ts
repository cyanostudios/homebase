// client/src/types/global.d.ts
// Global type declarations shared across frontend.
export {};

declare global {
  /** Vite client env (DEV / PROD / MODE). */
  interface ImportMeta {
    readonly env: {
      readonly DEV: boolean;
      readonly PROD: boolean;
      readonly MODE: string;
    };
    /** Vite HMR */
    readonly hot?: {
      accept: (callback?: (mod: unknown) => void) => void;
      invalidate: () => void;
    };
  }

  interface Window {}
}
