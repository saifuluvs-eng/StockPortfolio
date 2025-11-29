import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type HoverTooltipProps = {
  anchor: HTMLElement | null;
  label: string;
  show: boolean;
};

export default function HoverTooltip({ anchor, label, show }: HoverTooltipProps) {
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const raf = useRef<number>();

  useEffect(() => {
    if (!show || !anchor) return undefined;
    const update = () => {
      const rect = anchor.getBoundingClientRect();
      setPos({ top: rect.top + rect.height / 2, left: rect.right + 8 });
      raf.current = requestAnimationFrame(update);
    };
    update();
    return () => {
      if (raf.current) {
        cancelAnimationFrame(raf.current);
      }
    };
  }, [show, anchor]);

  if (!show || !anchor) return null;

  return createPortal(
    <div
      className="fixed -translate-y-1/2 z-[9999] px-2.5 py-1.5 rounded-lg bg-black text-[#f7931a] text-xs shadow-2xl pointer-events-none"
      style={{ top: pos.top, left: pos.left }}
    >
      {label}
    </div>,
    document.body,
  );
}
