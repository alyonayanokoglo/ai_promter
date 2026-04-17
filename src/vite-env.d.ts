/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Опционально: URL серверного API оценки, по умолчанию /api/evaluate */
  readonly VITE_EVALUATION_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
