import { useState } from "react";
import { AppShell } from "./components/AppShell";
import { BackupsPage } from "./pages/BackupsPage";
import { ClientsPage } from "./pages/ClientsPage";
import { HomePage } from "./pages/HomePage";
import { LoansPage } from "./pages/LoansPage";
import { ReportsPage } from "./pages/ReportsPage";

export default function App() {
  const [view, setView] = useState("home");

  return (
    <AppShell view={view} onChangeView={setView}>
      {view === "clients" && <ClientsPage />}
      {view === "loans" && <LoansPage />}
      {view === "reports" && <ReportsPage />}
      {view === "backups" && <BackupsPage />}
      {view === "home" && (
        <HomePage
          onOpenClients={() => setView("clients")}
          onOpenLoans={() => setView("loans")}
        />
      )}
    </AppShell>
  );
}
