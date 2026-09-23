/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_ENVIRONMENT: "dev" | "qa" | "prod";
  readonly VITE_USE_MOCKS?: string;
  readonly VITE_MOCK_DELAY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
