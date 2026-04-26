/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

declare interface AppChangelogEntry {
  version: string;
  date: string;
  features: string[];
  fixes: string[];
}

declare const __APP_CHANGELOG__: AppChangelogEntry[];
