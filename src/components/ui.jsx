import { useRef, useEffect } from "react";
import { Icon } from "./Icon";

export function ToastContainer({ toasts }) {
  return (
    <div style={{ position: "fixed", bottom: 24, right: 20, zIndex: 999, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none" }}>
      {toasts.map(t => (
        <div key={t.id} style={{ background: "#1e1a18", border: "1px solid rgba(192,80,77,0.4)", borderLeft: "3px solid var(--red)", borderRadius: 8, padding: "11px 16px", maxWidth: 320, display: "flex", alignItems: "center", gap: 10, animation: "toastIn 0.25s ease", boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
          <Icon name="warn" size={15} color="var(--red)" />
          <span style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.4 }}>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

export function BloqueadoIA() {
  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 360, gap: 20, padding: 32, textAlign: "center" }}>
      <div style={{ width: 56, height: 56, borderRadius: 14, background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon name="lock" size={24} color="var(--text3)" />
      </div>
      <div>
        <div style={{ fontFamily: "'Barlow Condensed'", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Asistente IA no activado</div>
        <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.7, maxWidth: 320 }}>
          Esta función requiere activación. Contactá al desarrollador para obtener acceso al asistente de estudio con IA.
        </div>
      </div>
      <a href="https://www.frazk.lol" target="_blank" rel="noopener noreferrer" style={{
        background: "var(--blue)", color: "#fff", borderRadius: 8, padding: "10px 24px",
        fontSize: 13, fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: 8,
        transition: "background 0.2s"
      }}
        onMouseEnter={e => e.currentTarget.style.background = "var(--blue2)"}
        onMouseLeave={e => e.currentTarget.style.background = "var(--blue)"}>
        Contactar en frazk.lol
      </a>
    </div>
  );
}
export function ConfirmModal({ nombre, onConfirm, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="card fade-in" style={{ maxWidth: 360, width: "100%", padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <Icon name="warn" size={20} color="var(--red)" />
          <span style={{ fontFamily: "'Barlow Condensed'", fontSize: 16, fontWeight: 700 }}>Confirmar eliminación</span>
        </div>
        <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6, marginBottom: 20 }}>
          ¿Eliminar <strong style={{ color: "var(--text)" }}>{nombre}</strong>? Esta acción no se puede deshacer.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-ghost" style={{ flex: 1, justifyContent: "center" }} onClick={onClose}>Cancelar</button>
          <button style={{ flex: 1, padding: "8px", borderRadius: "var(--radius)", border: "none", background: "var(--red)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={onConfirm}>
            <Icon name="trash" size={13} color="#fff" />Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SHARED ───────────────────────────────────────────────────────────────────
export function Modal({ title, onClose, children, width = 520 }) {
  const innerRef = useRef(null);
  useEffect(() => {
    const fn = e => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    setTimeout(() => {
      const first = innerRef.current?.querySelector("input,select,textarea");
      if (first) first.focus();
    }, 50);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 200,
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      padding: "20px 16px", overflowY: "auto"
    }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={innerRef} className="card fade-in" style={{
        width: "100%", maxWidth: width,
        display: "flex", flexDirection: "column",
        position: "relative", marginTop: "auto", marginBottom: "auto",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px 0", flexShrink: 0 }}>
          <span style={{ fontFamily: "'Barlow Condensed'", fontSize: 17, fontWeight: 700 }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text2)", fontSize: 20, lineHeight: 1, padding: 4, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ padding: "16px 24px 24px" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
export function Lbl({ children }) { return <label style={{ fontSize: 11, color: "var(--text2)", marginBottom: 5, display: "block", fontWeight: 500 }}>{children}</label>; }
export function Spinner() { return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40, color: "var(--text2)", fontSize: 13, gap: 10 }}><div style={{ width: 18, height: 18, border: "2px solid var(--border2)", borderTop: "2px solid var(--blue)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />Cargando...</div>; }
