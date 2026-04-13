/// <reference types="vite/client" />

import type { DesktopApi } from "@shared/contracts";

declare global {
  interface Window {
    chessApp: DesktopApi;
  }
}

declare module "*.module.css" {
  const classes: Record<string, string>;
  export default classes;
}
