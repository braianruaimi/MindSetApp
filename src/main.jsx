import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AppStateProvider } from "./context/AppStateContext";
import "./index.css";
import { registerPwa } from "./registerPwa";
import { applyDefaultPin } from "./services/settingsLock";

registerPwa();
await applyDefaultPin();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AppStateProvider>
      <App />
    </AppStateProvider>
  </StrictMode>,
);
