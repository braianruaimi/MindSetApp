import { useState } from "react";
import { AppShell } from "./components/AppShell";
import { BackupsPage } from "./pages/BackupsPage";
import { ClientsPage } from "./pages/ClientsPage";
import { HomePage } from "./pages/HomePage";
import { LoansPage } from "./pages/LoansPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SettingsPage } from "./pages/SettingsPage";

export default function App() {
  const [view, setView] = useState("home");

  return (
    <AppShell view={view} onChangeView={setView}>
      {view === "clients" && <ClientsPage onOpenSettings={() => setView("settings")} />}
      {view === "loans" && <LoansPage onOpenSettings={() => setView("settings")} />}
      {view === "reports" && <ReportsPage onOpenSettings={() => setView("settings")} />}
      {view === "settings" && <SettingsPage onOpenBackups={() => setView("backups")} />}
      {view === "backups" && <BackupsPage />}
      {view === "home" && (
        <HomePage
          onOpenSettings={() => setView("settings")}
          onOpenClients={() => setView("clients")}
          onOpenLoans={() => setView("loans")}
        />
      )}
    </AppShell>
  );
}
