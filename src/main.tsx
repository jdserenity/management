import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "next-themes";
import { setSyncFetchImpl } from "@mgmt/sync";
import { getAppKind } from "@/lib/appRuntime";
import { desktopNativeFetch } from "@/lib/desktopNativeFetch";
import "./i18n";
import App from "./App";

if (getAppKind() === "desktop") {
  setSyncFetchImpl(desktopNativeFetch);
  void import("@/lib/syncServerConfig").then(({ loadSyncServerConfig }) => loadSyncServerConfig());
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
