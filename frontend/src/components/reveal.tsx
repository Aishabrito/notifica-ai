import { useEffect, useRef, useState } from "react";
import { RevealProps, LabelProps } from "./types";

export const useInView = (threshold = 0.1): [React.RefObject<HTMLDivElement | null>, boolean] => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setInView(true); },
      { threshold }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);

  return [ref, inView];
};

export const Reveal = ({ children, delay = 0, className = "" }: RevealProps) => {
  const [ref, inView] = useInView(0.08);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.65s ease ${delay}s, transform 0.65s ease ${delay}s`,
      }}
    >
      {children}
    </div>
  );
};

export const Label = ({ children }: LabelProps) => (
  <div className="flex items-center gap-3 mb-5">
    <div className="w-5 h-px bg-emerald-400" />
    <span className="font-mono text-xs text-emerald-400 tracking-widest uppercase">
      {children}
    </span>
  </div>
);