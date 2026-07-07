import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "next-themes";
import { setSyncFetchImpl } from "@mgmt/sync";
import { getAppKind } from "@/lib/appRuntime";
import { desktopNativeFetch } from "@/lib/desktopNativeFetch";
import DesktopBoot from "@/components/DesktopBoot";

if (getAppKind() === "desktop") {
  setSyncFetchImpl(desktopNativeFetch);
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <DesktopBoot />
    </ThemeProvider>
  </React.StrictMode>,
);
