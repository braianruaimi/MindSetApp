import { AnimatePresence, motion } from "framer-motion";
import { lazy, Suspense, useState } from "react";
import { Toaster } from "sonner";
import { AppShell } from "./components/AppShell";
import { PageSkeleton } from "./components/Skeleton";

const BackupsPage = lazy(() => import("./pages/BackupsPage").then((module) => ({ default: module.BackupsPage })));
const ClientsPage = lazy(() => import("./pages/ClientsPage").then((module) => ({ default: module.ClientsPage })));
const DashboardPage = lazy(() => import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const HomePage = lazy(() => import("./pages/HomePage").then((module) => ({ default: module.HomePage })));
const LoansPage = lazy(() => import("./pages/LoansPage").then((module) => ({ default: module.LoansPage })));

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
          <Suspense fallback={<PageSkeleton />}>
            {view === "dashboard" && <DashboardPage />}
            {view === "clients" && <ClientsPage />}
            {view === "loans" && <LoansPage />}
            {view === "backups" && <BackupsPage />}
            {view === "home" && <HomePage onOpenClients={() => setView("clients")} onOpenLoans={() => setView("loans")} />}
          </Suspense>
        </motion.div>
      </AnimatePresence>
      <Toaster theme="dark" position="top-center" richColors closeButton />
    </AppShell>
  );
}
