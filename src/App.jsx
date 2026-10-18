import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Toaster } from "sonner";
import { AppShell } from "./components/AppShell";
import { BackupsPage } from "./pages/BackupsPage";
import { ClientsPage } from "./pages/ClientsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { HomePage } from "./pages/HomePage";
import { LoansPage } from "./pages/LoansPage";

export default function App() {
  const [view, setView] = useState("dashboard");

  return (
    <AppShell view={view} onChangeView={setView}>
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {view === "dashboard" && <DashboardPage />}
          {view === "clients" && <ClientsPage />}
          {view === "loans" && <LoansPage />}
          {view === "backups" && <BackupsPage />}
          {view === "home" && <HomePage onOpenClients={() => setView("clients")} onOpenLoans={() => setView("loans")} />}
        </motion.div>
      </AnimatePresence>
      <Toaster theme="dark" position="top-center" richColors closeButton />
    </AppShell>
  );
}
