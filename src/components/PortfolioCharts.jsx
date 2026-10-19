import { motion } from "framer-motion";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CountUp } from "./CountUp";
import { formatMoney } from "../utils/money";

export function PortfolioCharts({
  portfolio,
  percent,
  report,
  projection,
  selectedPortfolio,
  onSelectPortfolio,
  selectedRows,
}) {
  return (
    <>
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-3xl p-5">
        <h2 className="font-medium text-white">Estado de la cartera</h2>
        <p className="mt-1 text-xs text-slate-400">Saldo cobrado frente al pendiente; las cuotas vencidas se separan del resto.</p>
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
                  onClick={(slice) => slice?.name && onSelectPortfolio(slice.name)}
                >
                  {(portfolio.total > 0 ? portfolio.slices : [{ color: "#334155" }]).map((slice, index) => (
                    <Cell key={index} fill={slice.color} stroke={selectedPortfolio === slice.name ? "#f8fafc" : "none"} strokeWidth={selectedPortfolio === slice.name ? 2 : 0} className="cursor-pointer" />
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
          <ul className="w-full flex-1 space-y-2 text-sm">
            {portfolio.slices.map((slice) => (
              <li key={slice.name}>
                <button
                  type="button"
                  aria-pressed={selectedPortfolio === slice.name}
                  onClick={() => onSelectPortfolio(selectedPortfolio === slice.name ? "" : slice.name)}
                  className={`w-full rounded-lg p-2 text-left transition ${selectedPortfolio === slice.name ? "bg-white/10" : "hover:bg-white/5"}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-slate-300">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
                      {slice.name}
                    </span>
                    <span className="font-medium text-white">{percent(slice.value)}%</span>
                  </span>
                  <span className="ml-4 block text-xs text-slate-500">{formatMoney(slice.value)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        {selectedPortfolio && (
          <div className="mt-3 border-t border-white/10 pt-3">
            <h3 className="text-sm font-medium text-white">Préstamos · {selectedPortfolio}</h3>
            {selectedRows.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">No hay importes en esta categoría.</p>
            ) : (
              <ul className="mt-2 divide-y divide-white/5">
                {selectedRows.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="text-slate-300">{row.clientName}</span>
                    <span className="font-medium text-white">{formatMoney(row.selectedAmount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </motion.section>

      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-3xl p-5">
        <h2 className="font-medium text-white">Interés proyectado vs cobrado</h2>
        <p className="text-xs text-slate-400">Acumulado por mes de vencimiento; la mora cobrada se excluye.</p>
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
                <Area type="monotone" dataKey="real" name="Interés cobrado" stroke="#34d399" strokeWidth={2} fill="url(#gradReal)" animationDuration={1400} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </motion.section>
    </>
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
