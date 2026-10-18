import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect } from "react";
import { formatMoney } from "../utils/money";

export function CountUp({ value, format = formatMoney, duration = 1.2 }) {
  const progress = useMotionValue(0);
  const text = useTransform(progress, (current) => format(Math.round(current)));

  useEffect(() => {
    const controls = animate(progress, value, { duration, ease: "easeOut" });
    return () => controls.stop();
  }, [progress, value, duration]);

  return <motion.span>{text}</motion.span>;
}
