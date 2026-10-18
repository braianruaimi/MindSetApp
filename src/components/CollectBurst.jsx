import { motion } from "framer-motion";
import { Check } from "lucide-react";

const PARTICLES = Array.from({ length: 12 }, (_, index) => (index / 12) * Math.PI * 2);

// Destello breve al registrar un cobro; cambia `trigger` para reproducirlo.
export function CollectBurst({ trigger }) {
  if (!trigger) return null;

  return (
    <div key={trigger} className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center" aria-hidden="true">
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: [0.4, 1.15, 1], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 1, times: [0, 0.3, 0.6, 1] }}
        className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-400 text-slate-900 shadow-[0_0_60px_rgb(52_211_153/0.7)]"
      >
        <Check size={40} strokeWidth={3} />
      </motion.div>
      {PARTICLES.map((angle) => (
        <motion.span
          key={angle}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: Math.cos(angle) * 110, y: Math.sin(angle) * 110, opacity: 0, scale: 0.4 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="absolute h-2.5 w-2.5 rounded-full bg-emerald-300"
        />
      ))}
    </div>
  );
}
