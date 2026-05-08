"use client";
import { useEffect, useState } from "react";

interface ToastProps {
  message: string;
  type?:   "success" | "error" | "info";
  onClose: () => void;
}

export function Toast({ message, type = "success", onClose }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  const color = type === "success" ? "var(--green)"  :
                type === "error"   ? "var(--accent)"  : "#7cb9ff";
  const icon  = type === "success" ? "✓" : type === "error" ? "✕" : "ℹ";

  return (
    <div className="toast" style={{ borderLeft: `3px solid ${color}` }}>
      <span style={{ color, fontWeight: 700, fontSize: 16, flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 13, color: "var(--text)" }}>{message}</span>
    </div>
  );
}

export function useToast() {
  const [t, setT] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const show = (message: string, type: "success" | "error" | "info" = "success") =>
    setT({ message, type });
  const ToastEl = t ? <Toast {...t} onClose={() => setT(null)} /> : null;
  return { show, ToastEl };
}
