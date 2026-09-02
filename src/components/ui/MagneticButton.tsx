import { motion, useMotionValue, useSpring, type HTMLMotionProps } from "framer-motion";
import type { MouseEvent, ReactNode } from "react";
import { cn } from "../../lib/utils";

interface MagneticButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  children: ReactNode;
  variant?: "primary" | "ghost";
}

export function MagneticButton({ children, className, variant = "primary", ...props }: MagneticButtonProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 250, damping: 18 });
  const springY = useSpring(y, { stiffness: 250, damping: 18 });

  function handleMove(e: MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - rect.left - rect.width / 2) * 0.35);
    y.set((e.clientY - rect.top - rect.height / 2) * 0.35);
  }

  function reset() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.button
      {...props}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      style={{ x: springX, y: springY }}
      whileTap={{ scale: 0.96 }}
      className={cn(
        "relative inline-flex cursor-pointer items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold tracking-wide transition-colors duration-200",
        variant === "primary" &&
          "bg-[var(--color-primary)] text-[#0a0f1c] shadow-[0_0_0_1px_rgba(245,166,35,0.4),0_18px_40px_-12px_rgba(245,166,35,0.55)] hover:bg-[var(--color-primary-soft)]",
        variant === "ghost" &&
          "glass text-[var(--color-text)] hover:border-[var(--color-accent)]/50",
        className,
      )}
    >
      {children}
    </motion.button>
  );
}
