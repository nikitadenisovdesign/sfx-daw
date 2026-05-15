import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Dev-time only: expose stores on window for smoke testing in the preview.
if (import.meta.env.DEV) {
  void Promise.all([
    import("./store/projectStore"),
    import("./store/uiStore"),
    import("./store/mixerStore"),
  ]).then(([p, u, m]) => {
    (window as unknown as { __sfx?: unknown }).__sfx = {
      projectStore: p.useProjectStore,
      uiStore: u.useUIStore,
      mixerStore: m.useMixerStore,
    };
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
