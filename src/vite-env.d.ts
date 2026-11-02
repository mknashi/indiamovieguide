/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GA_MEASUREMENT_ID?: string;
  readonly VITE_FORMS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
