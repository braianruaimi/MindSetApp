import { useContext } from "react";
import { PrivacyLockContext } from "./privacyLockContext";

export function usePrivacyLock() {
  const context = useContext(PrivacyLockContext);
  if (!context) throw new Error("usePrivacyLock debe usarse dentro de PrivacyLockProvider.");
  return context;
}
