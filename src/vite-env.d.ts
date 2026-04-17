/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY?: string;
  /** Опционально, например gemini-2.5-flash или gemini-3-flash-preview */
  readonly VITE_GEMINI_MODEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
