import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { installBrowserBridge } from "./dev/browserBridge.ts";
// Fonts are bundled (not loaded from the web) so the app works offline.
import "@fontsource/m-plus-rounded-1c/500.css";
import "@fontsource/m-plus-rounded-1c/700.css";
import "@fontsource/m-plus-rounded-1c/800.css";
import "@fontsource/pixelify-sans/500.css";
import "@fontsource/pixelify-sans/600.css";
import "@fontsource/pixelify-sans/700.css";
import "@fontsource/dotgothic16/400.css";
import "@fontsource/tiny5/400.css";
import "@fontsource/silkscreen/700.css";

// Dev only: lets the app run in a plain browser for UI checks (see CLAUDE.md).
installBrowserBridge();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
