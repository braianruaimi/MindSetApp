import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AppStateProvider } from "./context/AppStateContext";
import { PrivacyLockProvider } from "./context/PrivacyLockContext.jsx";
import "./index.css";
import { registerPwa } from "./registerPwa";

registerPwa();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <PrivacyLockProvider>
      <AppStateProvider>
        <App />
      </AppStateProvider>
    </PrivacyLockProvider>
  </StrictMode>,
);
