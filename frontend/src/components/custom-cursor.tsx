import { useEffect, useRef } from "react";

export const CustomCursor = () => {
  const dot   = useRef<HTMLDivElement>(null);
  const ring  = useRef<HTMLDivElement>(null);
  const mouse = useRef({ x: 0, y: 0 });
  const pos   = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const move = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };
      if (dot.current) {
        dot.current.style.left = `${e.clientX - 5}px`;
        dot.current.style.top  = `${e.clientY - 5}px`;
      }
    };

    window.addEventListener("mousemove", move);

    let raf: number;
    const loop = () => {
      pos.current.x += (mouse.current.x - pos.current.x) * 0.12;
      pos.current.y += (mouse.current.y - pos.current.y) * 0.12;
      if (ring.current) {
        ring.current.style.left = `${pos.current.x - 18}px`;
        ring.current.style.top  = `${pos.current.y - 18}px`;
      }
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      window.removeEventListener("mousemove", move);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div
        ref={dot}
        style={{
          position: "fixed", width: 10, height: 10,
          background: "#00e676", borderRadius: "50%",
          pointerEvents: "none", zIndex: 9999,
          mixBlendMode: "difference",
        }}
      />
      <div
        ref={ring}
        style={{
          position: "fixed", width: 36, height: 36,
          border: "1px solid rgba(0,230,118,0.4)", borderRadius: "50%",
          pointerEvents: "none", zIndex: 9998,
          transition: "left 0.35s ease, top 0.35s ease",
        }}
      />
    </>
  );
};