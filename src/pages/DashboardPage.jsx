import { motion } from "framer-motion";
import { AlertTriangle, Banknote, PiggyBank, TrendingUp, Wallet } from "lucide-react";
import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CountUp } from "../components/CountUp";
import { DashboardSkeleton } from "../components/Skeleton";
import { useAppState } from "../context/AppStateContext";
import { buildReport, monthlyProjection } from "../services/reports";
import { todayISODate } from "../utils/dates";
import { formatMoney } from "../utils/money";

const COLORS = { collected: "#34d399", street: "#38bdf8", overdue: "#fb923c" };

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

export function DashboardPage() {
  const { database, hydrated } = useAppState();
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
        const progress = total > 0 ? Math.min(100, Math.round(((row.recoveredCapital + row.collectedInterest) / total) * 100)) : 0;
        const paid = (loan?.installments ?? []).filter((installment) => installment.status === "paid").length;
        return { ...row, progress, paid, count: loan?.installments?.length ?? 0 };
      });
  }, [report, database.loans]);

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
        <Metric icon={TrendingUp} label="Ganancia real" value={report.realEarnings} detail={`Proyectada ${formatMoney(report.projectedInterest)}`} tone="positive" />
        <Metric icon={AlertTriangle} label="Atrasado" value={report.overdueAmount} detail={`${report.overdueCount} cuotas`} tone="danger" />
      </div>

      <motion.section variants={item} className="glass rounded-3xl p-5">
        <h2 className="font-medium text-white">Estado de la cartera</h2>
        <div className="mt-2 flex flex-col items-center gap-4 sm:flex-row">
          <div className="relative h-44 w-44 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={portfolio.total > 0 ? portfolio.slices : [{ name: "Sin datos", value: 1, color: "#334155" }]}
                  dataKey="value"
                  innerRadius={56}
                  outerRadius={80}
                  paddingAngle={portfolio.total > 0 ? 3 : 0}
                  stroke="none"
                  cornerRadius={6}
                  animationDuration={1200}
                >
                  {(portfolio.total > 0 ? portfolio.slices : [{ color: "#334155" }]).map((slice, index) => (
                    <Cell key={index} fill={slice.color} />
                  ))}
                </Pie>
                {portfolio.total > 0 && <Tooltip content={<MoneyTooltip />} />}
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-semibold text-white"><CountUp value={percent(report.cashCollected)} format={(n) => `${n}%`} /></span>
              <span className="text-xs text-slate-400">cobrado</span>
            </div>
          </div>
          <ul className="w-full flex-1 space-y-3 text-sm">
            {portfolio.slices.map((slice) => (
              <li key={slice.name}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-slate-300">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
                    {slice.name}
                  </span>
                  <span className="font-medium text-white">{percent(slice.value)}%</span>
                </div>
                <p className="ml-4 text-xs text-slate-500">{formatMoney(slice.value)}</p>
              </li>
            ))}
          </ul>
        </div>
      </motion.section>

      <motion.section variants={item} className="glass rounded-3xl p-5">
        <h2 className="font-medium text-white">Proyección de ganancias</h2>
        <p className="text-xs text-slate-400">Interés acumulado por mes de vencimiento</p>
        {projection.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">Cuando cargues préstamos verás la proyección aquí.</p>
        ) : (
          <div className="mt-3 h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={projection} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradProjected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradReal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgb(255 255 255 / 0.06)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<MoneyTooltip />} />
                <Area type="monotone" dataKey="proyectado" name="Proyectado" stroke="#38bdf8" strokeWidth={2} fill="url(#gradProjected)" animationDuration={1400} />
                <Area type="monotone" dataKey="real" name="Real" stroke="#34d399" strokeWidth={2} fill="url(#gradReal)" animationDuration={1400} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </motion.section>

      <motion.section variants={item} className="space-y-3">
        <h2 className="font-medium text-white">Préstamos activos</h2>
        {activeLoans.length === 0 && (
          <p className="glass rounded-2xl border-dashed px-4 py-8 text-center text-sm text-slate-500">No hay préstamos activos.</p>
        )}
        {activeLoans.map((loan) => (
          <div key={loan.id} className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-white">{loan.clientName}</p>
                <p className="text-xs text-slate-400">Cuota {loan.paid}/{loan.count} · faltan {formatMoney(loan.streetMoney)}</p>
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

function MoneyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/90 px-3 py-2 text-xs shadow-xl backdrop-blur">
      {label && <p className="mb-1 text-slate-400">{label}</p>}
      {payload.map((entry) => (
        <p key={entry.name} className="text-white">
          <span style={{ color: entry.payload?.color ?? entry.color }}>● </span>
          {entry.name}: {formatMoney(entry.value)}
        </p>
      ))}
    </div>
  );
}
