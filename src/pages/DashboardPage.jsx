import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Banknote, PiggyBank, TrendingUp, Wallet } from "lucide-react";
import { CountUp } from "../components/CountUp";
import { DashboardSkeleton } from "../components/Skeleton";
import { useAppState } from "../context/AppStateContext";
import { buildReport, monthlyProjection } from "../services/reports";
import { todayISODate } from "../utils/dates";
import { formatMoney } from "../utils/money";

const PortfolioCharts = lazy(() => import("../components/PortfolioCharts").then((module) => ({ default: module.PortfolioCharts })));
const COLORS = { collected: "#34d399", street: "#38bdf8", overdue: "#fb923c" };

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

export function DashboardPage() {
  const { database, hydrated } = useAppState();
  const [selectedPortfolio, setSelectedPortfolio] = useState("");
  const [chartsVisible, setChartsVisible] = useState(() => typeof IntersectionObserver === "undefined");
  const chartAnchor = useRef(null);
  const today = todayISODate();
  const report = useMemo(() => buildReport(database, today), [database, today]);
  const projection = useMemo(() => monthlyProjection(database), [database]);

  const portfolio = useMemo(() => {
    const onTime = Math.max(0, report.streetMoney - report.overdueAmount);
    const slices = [
      { name: "Cobrado", value: report.cashCollected, color: COLORS.collected },
      { name: "En la calle", value: onTime, color: COLORS.street },
      { name: "Atrasado", value: report.overdueAmount, color: COLORS.overdue },
    ];
    const total = slices.reduce((sum, slice) => sum + slice.value, 0);
    return { slices, total };
  }, [report]);

  const activeLoans = useMemo(() => {
    return report.rows
      .filter((row) => row.status !== "paid")
      .map((row) => {
        const loan = (database.loans ?? []).find((entry) => entry.id === row.id);
        const total = loan?.totalAmount || 0;
        const recovered = row.recoveredCapital + row.collectedInterest;
        const progress = total > 0 ? Math.min(100, Math.round((recovered / total) * 100)) : 0;
        const paid = (loan?.installments ?? []).filter((installment) => installment.status === "paid").length;
        return { ...row, progress, recovered, total, paid, count: loan?.installments?.length ?? 0 };
      });
  }, [report, database.loans]);

  const selectedPortfolioRows = useMemo(() => {
    if (!selectedPortfolio) return [];
    return report.rows
      .map((row) => {
        const amount = selectedPortfolio === "Cobrado"
          ? row.cashCollected
          : selectedPortfolio === "Atrasado"
            ? row.overdueAmount
            : row.streetMoney - row.overdueAmount;
        return { ...row, selectedAmount: amount };
      })
      .filter((row) => row.selectedAmount > 0);
  }, [report.rows, selectedPortfolio]);

  useEffect(() => {
    if (!hydrated || chartsVisible || !chartAnchor.current) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setChartsVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "0px 0px -55% 0px" });
    observer.observe(chartAnchor.current);
    return () => observer.disconnect();
  }, [hydrated, chartsVisible]);

  if (!hydrated) return <DashboardSkeleton />;

  const percent = (value) => (portfolio.total > 0 ? Math.round((value / portfolio.total) * 100) : 0);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="mx-auto w-full max-w-2xl space-y-4">
      <motion.header variants={item}>
        <p className="text-xs uppercase tracking-widest text-emerald-300/80">Resumen</p>
        <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
      </motion.header>

      <motion.section variants={item} className="glass relative overflow-hidden rounded-3xl p-5">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-400/20 blur-3xl" />
        <p className="flex items-center gap-2 text-sm text-slate-400"><Wallet size={16} /> Dinero en la calle</p>
        <p className="mt-2 text-4xl font-semibold tracking-tight text-white"><CountUp value={report.streetMoney} /></p>
        <p className="mt-2 text-sm text-slate-400">{report.activeLoans} préstamos activos de {report.loanCount}</p>
      </motion.section>

      <div className="grid grid-cols-2 gap-3">
        <Metric icon={Banknote} label="Capital prestado" value={report.capitalLent} tone="neutral" />
        <Metric icon={PiggyBank} label="Capital en caja" value={report.recoveredCapital} tone="positive" />
        <Metric icon={TrendingUp} label="Ganancia real" value={report.realEarnings} detail={`Interés ${formatMoney(report.collectedInterest)} · mora ${formatMoney(report.collectedLateFees)}`} tone="positive" />
        <Metric icon={AlertTriangle} label="Atrasado" value={report.overdueAmount} detail={`${report.overdueCount} cuotas vencidas`} tone="danger" />
      </div>

      <div ref={chartAnchor} className="space-y-4">
        {chartsVisible ? (
          <Suspense fallback={<ChartSkeleton />}>
            <PortfolioCharts
              portfolio={portfolio}
              percent={percent}
              report={report}
              projection={projection}
              selectedPortfolio={selectedPortfolio}
              onSelectPortfolio={setSelectedPortfolio}
              selectedRows={selectedPortfolioRows}
            />
          </Suspense>
        ) : <ChartSkeleton />}
      </div>

      <motion.section variants={item} className="space-y-3">
        <div>
          <h2 className="font-medium text-white">Préstamos activos</h2>
          <p className="text-xs text-slate-400">Progreso = capital e interés recuperados sobre el total pactado.</p>
        </div>
        {activeLoans.length === 0 && (
          <p className="glass rounded-2xl border-dashed px-4 py-8 text-center text-sm text-slate-500">No hay préstamos activos.</p>
        )}
        {activeLoans.map((loan) => (
          <div key={loan.id} className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-white">{loan.clientName}</p>
                <p className="text-xs text-slate-400">Cuota {loan.paid}/{loan.count} · recuperado {formatMoney(loan.recovered)} de {formatMoney(loan.total)}</p>
              </div>
              <span className={`text-sm font-semibold ${loan.overdueCount > 0 ? "text-orange-400" : "text-emerald-300"}`}>{loan.progress}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${loan.progress}%` }}
                transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
                className={`h-full rounded-full ${loan.overdueCount > 0 ? "bg-gradient-to-r from-orange-500 to-red-400" : "bg-gradient-to-r from-emerald-500 to-emerald-300"}`}
              />
            </div>
          </div>
        ))}
      </motion.section>
    </motion.div>
  );
}

const TONES = {
  neutral: { icon: "text-sky-300", glow: "bg-sky-400/10" },
  positive: { icon: "text-emerald-300", glow: "bg-emerald-400/10" },
  danger: { icon: "text-orange-400", glow: "bg-orange-400/10" },
};

function Metric({ icon: Icon, label, value, detail, tone }) {
  const styles = TONES[tone];
  return (
    <motion.article variants={item} whileTap={{ scale: 0.97 }} className="glass rounded-2xl p-4">
      <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${styles.glow} ${styles.icon}`}>
        <Icon size={18} />
      </span>
      <p className="mt-3 text-xs text-slate-400">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-white"><CountUp value={value} /></p>
      {detail && <p className="mt-0.5 text-xs text-slate-500">{detail}</p>}
    </motion.article>
  );
}

function ChartSkeleton() {
  return (
    <div className="space-y-4" aria-label="Gráficos disponibles al desplazarse">
      <div className="glass h-72 animate-pulse rounded-3xl" />
      <div className="glass h-64 animate-pulse rounded-3xl" />
    </div>
  );
}
