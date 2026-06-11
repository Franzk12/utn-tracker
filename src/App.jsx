import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { loadCache, saveCache } from "./offlineCache";
import { ejecutar } from "./db";
import { sb } from "./supabase";
import { ESTADOS, DIAS_SEMANA, HORAS, TIPO_EVENTO, MODOS_IA, MODELOS_IA, PLAN_ESTUDIO, MAIN_USER_ID, NAV, TITULOS } from "./constants";
import { G } from "./styles";
import { Icon } from "./components/Icon";




// ─── HOOKS ───────────────────────────────────────────────────────────────────
function useIsMobile() {
  const [m, setM] = useState(window.innerWidth < 768);
  useEffect(() => { const fn = () => setM(window.innerWidth < 768); window.addEventListener("resize", fn); return () => window.removeEventListener("resize", fn); }, []);
  return m;
}



// ─── TOAST ────────────────────────────────────────────────────────────────────
function ToastContainer({ toasts }) {
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

function useToast() {
  const [toasts, setToasts] = useState([]);
  const show = useCallback((msg) => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);
  return { toasts, show };
}

// ─── PUSH NOTIFICATIONS ───────────────────────────────────────────────────────
function usePushNotifications(userId) {
  const [estado, setEstado] = useState("idle"); // idle | solicitando | activo | denegado | no-soportado
  const [sub, setSub] = useState(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setEstado("no-soportado"); return;
    }
    if (Notification.permission === "granted") verificarSuscripcion();
    else if (Notification.permission === "denied") setEstado("denegado");
  }, [userId]);

  const verificarSuscripcion = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) { setSub(existing); setEstado("activo"); }
      else setEstado("idle");
    } catch { setEstado("idle"); }
  };

  const activar = async () => {
    if (!userId) return;
    setEstado("solicitando");
    try {
      // Registrar service worker
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // Pedir permiso
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") { setEstado("denegado"); return; }

      // Suscribirse al push
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      // Guardar suscripción en el servidor
      await fetch("/api/notify?action=subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription, userId }),
      });

      setSub(subscription);
      setEstado("activo");
    } catch (e) {
      console.error("Error activando push:", e);
      setEstado("idle");
    }
  };

  const desactivar = async () => {
    if (!sub) return;
    try {
      await fetch("/api/notify", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
      setSub(null); setEstado("idle");
    } catch (e) { console.error("Error desactivando push:", e); }
  };

  return { estado, activar, desactivar };
}

// Convertir VAPID key de base64 a Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

// ─── NOTIFICACIONES INTERNAS ──────────────────────────────────────────────────
function useNotificaciones(materias, eventos) {
  return useMemo(() => {
    const notifs = [];
    const hoy = new Date();
    const diasSem = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const dHoy = diasSem[hoy.getDay()];

    // Materias de hoy
    const matHoy = materias.filter(m => m.dias?.includes(dHoy) && ["cursando", "regular"].includes(m.estado));
    if (matHoy.length > 0) {
      notifs.push({
        id: "hoy",
        tipo: "info",
        titulo: `${matHoy.length} ${matHoy.length === 1 ? "materia" : "materias"} hoy`,
        detalle: matHoy.map(m => `${m.horarios?.[dHoy] || m.horario || ""} · ${m.nombre}`).join(" / "),
        icon: "horarios",
      });
    }

    // Eventos próximos (7 días)
    eventos.filter(e => {
      const d = Math.ceil((new Date(e.fecha) - hoy) / 86400000);
      return d >= 0 && d <= 7;
    }).sort((a, b) => new Date(a.fecha) - new Date(b.fecha)).forEach(ev => {
      const d = Math.ceil((new Date(ev.fecha) - hoy) / 86400000);
      const mat = materias.find(m => m.id === ev.materia_id);
      const tipo = TIPO_EVENTO[ev.tipo];
      notifs.push({
        id: `ev_${ev.id}`,
        tipo: d <= 1 ? "urgente" : "aviso",
        titulo: d === 0 ? `Hoy: ${ev.titulo}` : d === 1 ? `Mañana: ${ev.titulo}` : `En ${d}d: ${ev.titulo}`,
        detalle: `${mat?.nombre || ""}${ev.descripcion ? " · " + ev.descripcion : ""}`,
        color: tipo?.color,
        icon: "eventos",
      });
    });

    // Materias libres (recordatorio)
    const libres = materias.filter(m => m.estado === "libre");
    if (libres.length > 0) {
      notifs.push({
        id: "libres",
        tipo: "warning",
        titulo: `${libres.length} ${libres.length === 1 ? "materia libre" : "materias libres"} para recursar`,
        detalle: libres.map(m => m.nombre).join(", "),
        icon: "warn",
      });
    }

    // Finales próximos (30 días)
    const finales = eventos.filter(e => {
      const d = Math.ceil((new Date(e.fecha) - hoy) / 86400000);
      return e.tipo === "final" && d >= 0 && d <= 30;
    });
    if (finales.length > 0) {
      notifs.push({
        id: "finales",
        tipo: "aviso",
        titulo: `${finales.length} ${finales.length === 1 ? "final" : "finales"} en los próximos 30 días`,
        detalle: finales.map(e => { const d = Math.ceil((new Date(e.fecha) - hoy) / 86400000); return `${e.titulo} (${d === 0 ? "hoy" : d + "d"})`; }).join(", "),
        icon: "eventos",
        color: "#f87171",
      });
    }

    return notifs;
  }, [materias, eventos]);
}

function PanelNotificaciones({ materias, eventos, onClose }) {
  const notifs = useNotificaciones(materias, eventos);
  const colores = {
    urgente: { bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.35)", color: "#f87171" },
    aviso: { bg: "rgba(74,144,217,0.1)", border: "rgba(74,144,217,0.3)", color: "#4a90d9" },
    info: { bg: "rgba(110,231,183,0.08)", border: "rgba(110,231,183,0.25)", color: "#6ee7b7" },
    warning: { bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.25)", color: "#fbbf24" },
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="card fade-in" style={{ width: "100%", maxWidth: 440, margin: "auto", padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="bell" size={16} color="var(--blue)" />
            <span style={{ fontFamily: "'Barlow Condensed'", fontSize: 17, fontWeight: 700 }}>Notificaciones</span>
            {notifs.length > 0 && <span style={{ background: "var(--blue)", color: "#fff", borderRadius: 10, fontSize: 10, fontWeight: 700, padding: "1px 7px" }}>{notifs.length}</span>}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text2)", fontSize: 20, cursor: "pointer", padding: 4 }}>×</button>
        </div>
        <div style={{ maxHeight: "70vh", overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {notifs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text2)", fontSize: 13 }}>
              Sin notificaciones por ahora
            </div>
          ) : notifs.map(n => {
            const c = colores[n.tipo] || colores.info;
            return (
              <div key={n.id} style={{ background: c.bg, border: `1px solid ${n.color || c.border}22`, borderLeft: `3px solid ${n.color || c.color}`, borderRadius: 8, padding: "11px 14px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: n.color || c.color, marginBottom: 3 }}>{n.titulo}</div>
                {n.detalle && <div style={{ fontSize: 11, color: "var(--text2)", lineHeight: 1.5 }}>{n.detalle}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── BLOQUEO ASISTENTE IA ─────────────────────────────────────────────────────
function BloqueadoIA() {
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
function ConfirmModal({ nombre, onConfirm, onClose }) {
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
function Modal({ title, onClose, children, width = 520 }) {
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
function Lbl({ children }) { return <label style={{ fontSize: 11, color: "var(--text2)", marginBottom: 5, display: "block", fontWeight: 500 }}>{children}</label>; }
function Spinner() { return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40, color: "var(--text2)", fontSize: 13, gap: 10 }}><div style={{ width: 18, height: 18, border: "2px solid var(--border2)", borderTop: "2px solid var(--blue)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />Cargando...</div>; }

// ─── AUTH ─────────────────────────────────────────────────────────────────────
function AuthPage({ onAuth }) {
  const [modo, setModo] = useState("login");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [nombre, setNombre] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);
  const submit = async () => {
    setErr(""); setLoading(true);
    if (!navigator.onLine) { setErr("Necesitás conexión a internet para iniciar sesión."); setLoading(false); return; }
    try {
      if (modo === "login") {
        const { error } = await sb.auth.signInWithPassword({ email, password: pass });
        if (error) setErr(error.message); else onAuth();
      } else {
        const { error } = await sb.auth.signUp({ email, password: pass, options: { data: { nombre } } });
        if (error) setErr(error.message); else setOk(true);
      }
    } catch {
      setErr("No se pudo conectar. Revisá tu internet e intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <style>{G}</style>
      <div className="card" style={{ width: "100%", maxWidth: 380, padding: 32 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 44, height: 44, background: "var(--blue)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Barlow Condensed'", fontWeight: 800, color: "#fff", fontSize: 22, margin: "0 auto 12px" }}>U</div>
          <div style={{ fontFamily: "'Barlow Condensed'", fontWeight: 800, fontSize: 22, letterSpacing: 0.5 }}>UTN TRACKER</div>
          <div style={{ fontSize: 11, color: "var(--text3)", letterSpacing: 1.5, marginTop: 2 }}>SISTEMAS · TUC</div>
        </div>
        {ok ? (
          <div style={{ textAlign: "center", color: "var(--text2)", fontSize: 13, lineHeight: 1.6 }}>
            <div style={{ fontSize: 28, marginBottom: 12, color: "var(--green)" }}>✓</div>
            Revisá tu email para confirmar la cuenta y luego iniciá sesión.
            <button className="btn-ghost" style={{ marginTop: 16, width: "100%", justifyContent: "center" }} onClick={() => { setOk(false); setModo("login"); }}>Ir al login</button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 6, marginBottom: 20, background: "var(--surface2)", borderRadius: 8, padding: 4 }}>
              {["login", "registro"].map(m => (
                <button key={m} onClick={() => { setModo(m); setErr(""); }} style={{ flex: 1, padding: "7px", borderRadius: 6, border: "none", background: modo === m ? "var(--blue)" : "transparent", color: modo === m ? "#fff" : "var(--text2)", fontSize: 13, fontWeight: modo === m ? 600 : 400, transition: "all 0.15s" }}>
                  {m === "login" ? "Iniciar sesión" : "Registrarse"}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {modo === "registro" && <div><Lbl>Nombre</Lbl><input style={{ width: "100%" }} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre" /></div>}
              <div><Lbl>Email</Lbl><input style={{ width: "100%" }} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" /></div>
              <div><Lbl>Contraseña</Lbl><input style={{ width: "100%" }} type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === "Enter" && submit()} /></div>
              {err && <div style={{ fontSize: 12, color: "var(--red)", background: "rgba(192,80,77,0.1)", padding: "8px 12px", borderRadius: 6 }}>{err}</div>}
              <button className="btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 4, opacity: loading ? 0.6 : 1 }} onClick={submit} disabled={loading}>
                {loading ? "Cargando..." : (modo === "login" ? "Entrar" : "Crear cuenta")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
function Dashboard({ materias, eventos }) {
  const [subVista, setSubVista] = useState("resumen"); // 'resumen' | 'analisis'
  const hoy = new Date();
  const stats = useMemo(() => {
    const total = materias.length;
    const aprobadas = materias.filter(m => m.estado === "aprobada_final" || m.estado === "promocionada").length;
    const cursando = materias.filter(m => m.estado === "cursando").length;
    const regulares = materias.filter(m => m.estado === "regular").length;
    const libres = materias.filter(m => m.estado === "libre").length;
    const notas = materias.filter(m => m.nota).map(m => m.nota);
    const promedio = notas.length ? (notas.reduce((a, b) => a + Number(b), 0) / notas.length).toFixed(1) : "—";
    const progreso = total ? Math.round((aprobadas / total) * 100) : 0;
    return { total, aprobadas, cursando, regulares, libres, promedio, progreso };
  }, [materias]);
  const prox = eventos.filter(e => new Date(e.fecha) >= hoy).sort((a, b) => new Date(a.fecha) - new Date(b.fecha)).slice(0, 5);
  const dR = f => { const d = Math.ceil((new Date(f) - hoy) / 86400000); return d === 0 ? "Hoy" : d === 1 ? "Mañana" : `${d}d`; };
  const SC = ({ label, value, sub, accent = "var(--text)" }) => (
    <div className="card" style={{ padding: "16px 18px" }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "var(--text3)", marginBottom: 5 }}>{label}</div>
      <div style={{ fontFamily: "'Barlow Condensed'", fontSize: 34, fontWeight: 800, color: accent, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 3 }}>{sub}</div>}
    </div>
  );
  const diasSem = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const dHoy = diasSem[hoy.getDay()];
  const matHoy = materias.filter(m => m.dias?.includes(dHoy) && ["cursando", "regular"].includes(m.estado));
  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Selector de sub-vista */}
      <div style={{ display: "flex", gap: 1, background: "var(--surface2)", borderRadius: 7, padding: 3, width: "fit-content" }}>
        {[{ id: "resumen", label: "Resumen" }, { id: "analisis", label: "Análisis de Promedio" }].map(v => (
          <button key={v.id} onClick={() => setSubVista(v.id)} style={{
            padding: "5px 16px", borderRadius: 5, border: "none", fontSize: 12, fontWeight: 600,
            background: subVista === v.id ? "var(--blue)" : "transparent",
            color: subVista === v.id ? "#fff" : "var(--text2)", transition: "all 0.15s"
          }}>{v.label}</button>
        ))}
      </div>

      {subVista === "resumen" ? (
        <>
          <p style={{ color: "var(--text2)", fontSize: 13 }}>Resumen de tu situación académica.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 9 }}>
            <SC label="Progreso" value={`${stats.progreso}%`} sub={`${stats.aprobadas} de ${stats.total}`} accent="var(--blue)" />
            <SC label="Cursando" value={stats.cursando} sub="activas" accent="var(--blue)" />
            <SC label="Regulares" value={stats.regulares} sub="para final" accent="var(--slate)" />
            <SC label="Libres" value={stats.libres} sub="a recursar" accent="var(--red)" />
            <SC label="Promedio" value={stats.promedio} sub="notas" />
          </div>
          <div className="card" style={{ padding: "16px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 9 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Avance de carrera</span>
              <span style={{ fontFamily: "'DM Mono'", fontSize: 12, color: "var(--blue)" }}>{stats.aprobadas}/{stats.total}</span>
            </div>
            <div style={{ background: "var(--surface3)", borderRadius: 3, height: 5 }}>
              <div style={{ height: "100%", width: `${stats.progreso}%`, background: "var(--blue)", borderRadius: 3, transition: "width 0.6s" }} />
            </div>
            <div style={{ display: "flex", gap: 7, marginTop: 12, flexWrap: "wrap" }}>
              {Object.entries(ESTADOS).map(([k, v]) => { const c = materias.filter(m => m.estado === k).length; return c ? <span key={k} className="tag" style={{ background: v.bg, color: v.color }}>{v.label} {c}</span> : null; })}
            </div>
          </div>
          {prox.length > 0 && (
            <div>
              <p className="section-title">Próximos eventos</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {prox.map(ev => {
                  const mat = materias.find(m => m.id === ev.materia_id);
                  const tipo = TIPO_EVENTO[ev.tipo];
                  return (
                    <div key={ev.id} className="card" style={{ padding: "11px 14px", display: "flex", alignItems: "center", gap: 11 }}>
                      <div style={{ width: 3, height: 34, borderRadius: 2, background: tipo.color, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{ev.titulo}</span>
                          <span className="tag" style={{ background: `${tipo.color}18`, color: tipo.color }}>{tipo.label}</span>
                        </div>
                        <span style={{ fontSize: 11, color: "var(--text2)" }}>{mat?.nombre}{ev.descripcion && ` · ${ev.descripcion}`}</span>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontFamily: "'DM Mono'", fontSize: 12, color: "var(--blue)", fontWeight: 500 }}>{dR(ev.fecha)}</div>
                        <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 1 }}>{new Date(ev.fecha + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div>
            <p className="section-title">Hoy — {dHoy}</p>
            {matHoy.length === 0 ? <div className="card" style={{ padding: 14, color: "var(--text2)", fontSize: 13 }}>No hay clases cargadas para hoy</div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {matHoy.sort((a, b) => {
                  const ha = a.horarios?.[dHoy] || a.horario || "";
                  const hb = b.horarios?.[dHoy] || b.horario || "";
                  return ha.localeCompare(hb);
                }).map(m => {
                  const est = ESTADOS[m.estado]; const horHoy = m.horarios?.[dHoy] || m.horario || ""; return (
                    <div key={m.id} className="card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 11 }}>
                      <span style={{ fontFamily: "'DM Mono'", fontSize: 12, color: "var(--blue)", minWidth: 44 }}>{horHoy}</span>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{m.nombre}</span>
                      <span style={{ fontSize: 11, color: "var(--text2)" }}>Aula {m.aula}</span>
                      <span className="tag" style={{ background: est.bg, color: est.color }}>{est.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        <VistaAnalisis materias={materias} />
      )}
    </div>
  );
}

// ─── MATERIAS ─────────────────────────────────────────────────────────────────
// ─── ANÁLISIS DE PROMEDIO ────────────────────────────────────────────────────
function VistaAnalisis({ materias }) {
  const aprobadas = useMemo(() => materias.filter(m => m.nota && m.nota >= 4).sort((a, b) => a.año - b.año || a.cuatrimestre - b.cuatrimestre), [materias]);
  const todasConNota = useMemo(() => materias.filter(m => m.nota).sort((a, b) => a.año - b.año || a.cuatrimestre - b.cuatrimestre), [materias]);

  const calcularPromedio = (lista) => {
    if (!lista.length) return 0;
    return (lista.reduce((a, b) => a + Number(b.nota), 0) / lista.length).toFixed(2);
  };

  const promAprobadas = calcularPromedio(aprobadas);
  const promGeneral = calcularPromedio(todasConNota);

  // Datos para el gráfico de evolución
  const puntos = useMemo(() => {
    let suma = 0;
    return todasConNota.map((m, i) => {
      suma += Number(m.nota);
      return { x: i, y: (suma / (i + 1)).toFixed(2), nombre: m.nombre };
    });
  }, [todasConNota]);

  // Simulador
  const [simMaterias, setSimMaterias] = useState(1);
  const [simNota, setSimNota] = useState(8);
  const promSimulado = useMemo(() => {
    const sumaActual = todasConNota.reduce((a, b) => a + Number(b.nota), 0);
    const totalActual = todasConNota.length;
    const sumaSim = sumaActual + (simMaterias * simNota);
    const totalSim = totalActual + Number(simMaterias);
    return (sumaSim / totalSim).toFixed(2);
  }, [todasConNota, simMaterias, simNota]);

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 5 }}>Promedio General</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "var(--blue)", fontFamily: "'Barlow Condensed'" }}>{promGeneral}</div>
          <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 2 }}>Incluye todas las notas ({todasConNota.length})</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 5 }}>Solo Aprobadas</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "var(--green)", fontFamily: "'Barlow Condensed'" }}>{promAprobadas}</div>
          <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 2 }}>Sin contar aplazos ({aprobadas.length})</div>
        </div>
      </div>

      {/* Gráfico de Evolución */}
      <div className="card" style={{ padding: 18 }}>
        <p className="section-title">Evolución del Promedio</p>
        {puntos.length < 2 ? (
          <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text3)", fontSize: 13 }}>Necesitás al menos 2 notas para ver la evolución</div>
        ) : (
          <div style={{ height: 160, width: "100%", marginTop: 10, position: "relative", display: "flex", alignItems: "flex-end", gap: 2 }}>
            {puntos.map((p, i) => {
              const h = (p.y / 10) * 100;
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: 5, position: "relative" }} title={`${p.nombre}: ${p.y}`}>
                  <div style={{ width: "100%", height: `${h}%`, background: "var(--blue-mid)", borderTop: "2px solid var(--blue)", borderRadius: "2px 2px 0 0", transition: "height 0.5s" }} />
                  <span style={{ fontSize: 9, color: "var(--text3)", fontFamily: "'DM Mono'" }}>{p.y}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Simulador */}
      <div className="card" style={{ padding: 18, background: "var(--surface2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Icon name="refresh" size={16} color="var(--blue)" />
          <p className="section-title" style={{ marginBottom: 0 }}>Simulador de Promedio</p>
        </div>
        <p style={{ fontSize: 12, color: "var(--text2)", marginBottom: 16 }}>Calculá cómo cambiaría tu promedio con tus próximos exámenes.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          <div>
            <Lbl>¿Cuántas rendís?</Lbl>
            <input type="number" style={{ width: "100%" }} value={simMaterias} onChange={e => setSimMaterias(e.target.value)} min={1} />
          </div>
          <div>
            <Lbl>Nota estimada</Lbl>
            <input type="number" style={{ width: "100%" }} value={simNota} onChange={e => setSimNota(e.target.value)} min={1} max={10} />
          </div>
        </div>
        <div style={{ background: "var(--surface)", padding: 14, borderRadius: 8, border: "1px solid var(--border)", textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Tu nuevo promedio sería</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: Number(promSimulado) >= Number(promGeneral) ? "var(--green)" : "var(--red)", fontFamily: "'Barlow Condensed'" }}>{promSimulado}</div>
          <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 4 }}>
            {Number(promSimulado) >= Number(promGeneral) ? "↑ Subiría " : "↓ Bajaría "}
            {Math.abs(promSimulado - promGeneral).toFixed(2)} puntos
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── VISTA ENFOQUE (POMODORO) ────────────────────────────────────────────────
function VistaEnfoque({ materias, sessionEnfoque, onStart, onPause, onReset, onSetModo }) {
  const { mins, secs, activo, modo, matId, progreso } = sessionEnfoque;

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30, padding: "20px 0" }}>
      <div style={{ textAlign: "center" }}>
        <h2 style={{ fontFamily: "'Barlow Condensed'", fontSize: 24, fontWeight: 800, color: modo === "estudio" ? "var(--blue)" : "var(--green)" }}>
          {modo === "estudio" ? "MODO ENFOQUE" : "TIEMPO DE DESCANSO"}
        </h2>
        <p style={{ fontSize: 13, color: "var(--text3)", marginTop: 5 }}>Mantené la concentración en un solo tema.</p>
      </div>

      {/* Selector de Materia */}
      {!activo && (
        <div style={{ width: "100%", maxWidth: 300 }}>
          <Lbl>¿Qué vas a estudiar?</Lbl>
          <select style={{ width: "100%", marginTop: 5 }} value={matId} onChange={e => onStart(null, e.target.value)}>
            <option value="">Seleccionar materia...</option>
            {materias.filter(m => ["cursando", "regular"].includes(m.estado)).map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
        </div>
      )}

      {/* Timer Circular */}
      <div style={{ position: "relative", width: 240, height: 240, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg style={{ position: "absolute", transform: "rotate(-90deg)", width: "100%", height: "100%" }}>
          <circle cx="120" cy="120" r="110" stroke="var(--surface2)" strokeWidth="8" fill="none" />
          <circle cx="120" cy="120" r="110" stroke={modo === "estudio" ? "var(--blue)" : "var(--green)"} strokeWidth="8" fill="none" strokeDasharray="691" strokeDashoffset={691 - (691 * (progreso / 100))} style={{ transition: "stroke-dashoffset 0.5s linear" }} strokeLinecap="round" />
        </svg>
        <div style={{ textAlign: "center", zIndex: 2 }}>
          <div style={{ fontFamily: "'DM Mono'", fontSize: 54, fontWeight: 700, color: "var(--text)" }}>
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </div>
          {matId && <div style={{ fontSize: 11, color: "var(--blue)", fontWeight: 700, textTransform: "uppercase", marginTop: -5 }}>{materias.find(m => m.id === matId)?.nombre}</div>}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button className="btn-primary" style={{ padding: "12px 40px", fontSize: 16 }} onClick={() => activo ? onPause() : onStart()}>
          {activo ? "Pausar" : "Empezar"}
        </button>
        <button className="btn-ghost" style={{ padding: "12px 20px" }} onClick={onReset}>Reiniciar</button>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button className="tag" onClick={() => onSetModo("estudio")} style={{ background: modo === "estudio" ? "var(--blue-dim)" : "var(--surface2)", color: modo === "estudio" ? "var(--blue)" : "var(--text3)", cursor: "pointer", border: "none" }}>Pomodoro (25m)</button>
        <button className="tag" onClick={() => onSetModo("descanso")} style={{ background: modo === "descanso" ? "var(--green-dim)" : "var(--surface2)", color: modo === "descanso" ? "var(--green)" : "var(--text3)", cursor: "pointer", border: "none" }}>Descanso (5m)</button>
      </div>
    </div>
  );
}

function FormMateria({ initial, onSave, onClose }) {
  const [f, setF] = useState(() => {
    const base = initial || { nombre: "", año: 1, cuatrimestre: 1, estado: "pendiente", nota: "", hs: 4, dias: [], horarios: {}, aula: "" };
    // Borrador para nuevas materias
    if (!initial) {
      const draft = localStorage.getItem("utn_draft_materia");
      if (draft) return JSON.parse(draft);
    }
    // compatibilidad con datos viejos que tienen campo horario plano
    if (initial && initial.horario && !initial.horarios) {
      const h = {};
      (initial.dias || []).forEach(d => { h[d] = initial.horario; });
      return { ...base, horarios: h };
    }
    return { ...base, horarios: base.horarios || {} };
  });

  useEffect(() => {
    if (!initial) localStorage.setItem("utn_draft_materia", JSON.stringify(f));
  }, [f, initial]);
  const [errs, setErrs] = useState({});
  const s = (k, v) => setF(p => ({ ...p, [k]: v }));

  const tD = d => {
    const diasActuales = f.dias || [];
    if (diasActuales.includes(d)) {
      const nuevosDias = diasActuales.filter(x => x !== d);
      const nuevosHorarios = { ...f.horarios };
      delete nuevosHorarios[d];
      setF(p => ({ ...p, dias: nuevosDias, horarios: nuevosHorarios }));
    } else {
      setF(p => ({ ...p, dias: [...diasActuales, d], horarios: { ...p.horarios, [d]: "14:00-16:00" } }));
    }
  };

  const setHorarioRango = (dia, tipo, val) => {
    setF(p => {
      const actual = p.horarios?.[dia] || "14:00-16:00";
      const [start = "14:00", end = "16:00"] = actual.split("-");
      const nuevo = tipo === "start" ? `${val}-${end}` : `${start}-${val}`;
      return { ...p, horarios: { ...p.horarios, [dia]: nuevo } };
    });
  };

  const nN = ["aprobada_final", "promocionada", "regular"].includes(f.estado);

  const validar = () => {
    const e = {};
    if (!f.nombre.trim()) e.nombre = "El nombre es requerido";
    if (nN && f.nota !== "") {
      const n = Number(f.nota);
      if (isNaN(n) || n < 1 || n > 10) e.nota = "La nota debe ser entre 1 y 10";
    }
    setErrs(e);
    return Object.keys(e).length === 0;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
      <div>
        <Lbl>Nombre</Lbl>
        <input style={{ width: "100%", borderColor: errs.nombre ? "var(--red)" : undefined }} value={f.nombre} onChange={e => { s("nombre", e.target.value); setErrs(p => ({ ...p, nombre: "" })); }} placeholder="Ej: Algoritmos y Estructura de Datos" />
        {errs.nombre && <div className="field-error">{errs.nombre}</div>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 9 }}>
        <div><Lbl>Año</Lbl><select style={{ width: "100%" }} value={f.año} onChange={e => s("año", +e.target.value)}>{[1, 2, 3, 4, 5].map(n => <option key={n}>{n}</option>)}</select></div>
        <div><Lbl>Cuatrimestre</Lbl><select style={{ width: "100%" }} value={f.cuatrimestre} onChange={e => s("cuatrimestre", +e.target.value)}><option value={1}>1°</option><option value={2}>2°</option></select></div>
        <div><Lbl>Hs/sem</Lbl><input type="number" style={{ width: "100%" }} value={f.hs} onChange={e => s("hs", +e.target.value)} min={1} max={12} /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
        <div><Lbl>Estado</Lbl><select style={{ width: "100%" }} value={f.estado} onChange={e => s("estado", e.target.value)}>{Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
        {nN && <div>
          <Lbl>Nota</Lbl>
          <input type="number" style={{ width: "100%", borderColor: errs.nota ? "var(--red)" : undefined }} value={f.nota || ""} onChange={e => { s("nota", e.target.value); setErrs(p => ({ ...p, nota: "" })); }} min={1} max={10} placeholder="1–10" />
          {errs.nota && <div className="field-error">{errs.nota}</div>}
        </div>}
      </div>

      {/* Días con horario individual */}
      <div>
        <Lbl>Días y horarios de cursado</Lbl>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
          {DIAS_SEMANA.map(d => (
            <button key={d} onClick={() => tD(d)} style={{
              padding: "5px 10px", borderRadius: 5, fontSize: 12,
              border: `1px solid ${f.dias?.includes(d) ? "var(--blue)" : "var(--border)"}`,
              background: f.dias?.includes(d) ? "var(--blue-dim)" : "transparent",
              color: f.dias?.includes(d) ? "var(--blue)" : "var(--text2)", transition: "all 0.15s"
            }}>{d}</button>
          ))}
        </div>
        {/* Selector de hora por día seleccionado */}
        {f.dias?.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {f.dias.map(d => {
              const str = f.horarios?.[d] || "14:00-16:00";
              const [start = "14:00", end = "16:00"] = str.split("-");
              return (
                <div key={d} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--surface2)", borderRadius: 7, padding: "8px 12px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--blue)", minWidth: 60 }}>{d}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                    <select value={start} onChange={e => setHorarioRango(d, "start", e.target.value)} style={{ flex: 1, fontSize: 12, padding: "5px 8px", minWidth: 70 }}>
                      {HORAS.map(h => <option key={h}>{h}</option>)}
                    </select>
                    <span style={{ color: "var(--text3)", fontSize: 12 }}>a</span>
                    <select value={end} onChange={e => setHorarioRango(d, "end", e.target.value)} style={{ flex: 1, fontSize: 12, padding: "5px 8px", minWidth: 70 }}>
                      {HORAS.map(h => <option key={h}>{h}</option>)}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <Lbl>Aula</Lbl>
        <input style={{ width: "100%" }} value={f.aula} onChange={e => s("aula", e.target.value)} placeholder="Ej: Lab1" />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button className="btn-primary" style={{ flex: 1 }} onClick={() => { if (validar()) { localStorage.removeItem("utn_draft_materia"); onSave(f); } }}>{initial ? "Guardar cambios" : "Agregar materia"}</button>
        <button className="btn-ghost" onClick={() => { localStorage.removeItem("utn_draft_materia"); onClose(); }}>Cancelar</button>
      </div>
    </div>
  );
}

function VistasMaterias({ materias, onAdd, onEdit, onDelete }) {
  const [subVista, setSubVista] = useState("lista"); // 'lista' | 'mapa'
  const [filtro, setFiltro] = useState("all");
  const [busq, setBusq] = useState("");
  const [edit, setEdit] = useState(null);
  const [add, setAdd] = useState(() => !!localStorage.getItem("utn_draft_materia"));
  const [confirm, setConfirm] = useState(null); // {id, nombre}
  const fil = useMemo(() => materias.filter(m => (filtro === "all" || m.estado === filtro) && m.nombre.toLowerCase().includes(busq.toLowerCase())).sort((a, b) => a.año - b.año || a.cuatrimestre - b.cuatrimestre), [materias, filtro, busq]);
  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 13 }}>
      {/* Selector de sub-vista */}
      <div style={{ display: "flex", gap: 1, background: "var(--surface2)", borderRadius: 7, padding: 3, width: "fit-content", marginBottom: 4 }}>
        {[{ id: "lista", label: "Lista" }, { id: "mapa", label: "Mapa (Malla)" }].map(v => (
          <button key={v.id} onClick={() => setSubVista(v.id)} style={{
            padding: "5px 16px", borderRadius: 5, border: "none", fontSize: 12, fontWeight: 600,
            background: subVista === v.id ? "var(--blue)" : "transparent",
            color: subVista === v.id ? "#fff" : "var(--text2)", transition: "all 0.15s"
          }}>{v.label}</button>
        ))}
      </div>

      {subVista === "lista" ? (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input style={{ flex: 1, minWidth: 160 }} value={busq} onChange={e => setBusq(e.target.value)} placeholder="Buscar materia..." />
            <select value={filtro} onChange={e => setFiltro(e.target.value)} style={{ minWidth: 140 }}>
              <option value="all">Todos los estados</option>
              {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <button className="btn-primary" onClick={() => setAdd(true)}><Icon name="plus" size={14} color="#fff" />Agregar</button>
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {["all", ...Object.keys(ESTADOS)].map(k => {
              const c = k === "all" ? materias.length : materias.filter(m => m.estado === k).length;
              const est = k === "all" ? null : ESTADOS[k]; const ac = filtro === k;
              return <button key={k} onClick={() => setFiltro(k)} style={{ padding: "3px 10px", borderRadius: 4, fontSize: 11, fontWeight: 500, border: `1px solid ${ac ? (est?.color || "var(--blue)") : "var(--border)"}`, background: ac ? (est?.bg || "var(--blue-dim)") : "transparent", color: ac ? (est?.color || "var(--blue)") : "var(--text2)", transition: "all 0.15s" }}>{k === "all" ? "Todas" : est.label} ({c})</button>;
            })}
          </div>
          {fil.length === 0 ? <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--text2)", fontSize: 13 }}>Sin resultados</div> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {fil.map(m => {
                const est = ESTADOS[m.estado]; return (
                  <div key={m.id} className="card" style={{ padding: "11px 14px", display: "flex", alignItems: "center", gap: 11, transition: "border-color 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = "var(--border2)"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}>
                    <div style={{ width: 3, alignSelf: "stretch", borderRadius: 2, background: est.color, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{m.nombre}</span>
                        <span className="tag" style={{ background: est.bg, color: est.color }}>{est.label}</span>
                        {m.nota && <span className="mono tag" style={{ background: "var(--blue-dim)", color: "var(--blue)", fontSize: 10 }}>{m.nota}/10</span>}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text2)", display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <span>Año {m.año} · {m.cuatrimestre}° cuat.</span>
                        {m.dias?.length > 0 && <span>{m.dias.map(d => `${d} ${m.horarios?.[d] || m.horario || ""}`).join(", ")}</span>}
                        {m.aula && <span>Aula: {m.aula}</span>}
                        <span>{m.hs} hs/sem</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button className="btn-ghost" style={{ padding: "5px 9px", fontSize: 12 }} onClick={() => setEdit(m)}><Icon name="edit" size={13} />Editar</button>
                      <button className="btn-danger" onClick={() => setConfirm({ id: m.id, nombre: m.nombre })}><Icon name="trash" size={13} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <VistaMapa materias={materias} onAdd={onAdd} />
      )}

      {add && <Modal title="Nueva Materia" onClose={() => setAdd(false)}><FormMateria onSave={f => { onAdd(f); setAdd(false); }} onClose={() => setAdd(false)} /></Modal>}
      {edit && <Modal title="Editar Materia" onClose={() => setEdit(null)}><FormMateria initial={edit} onSave={f => { onEdit(edit.id, f); setEdit(null); }} onClose={() => setEdit(null)} /></Modal>}
      {confirm && <ConfirmModal nombre={confirm.nombre} onClose={() => setConfirm(null)} onConfirm={() => { onDelete(confirm.id); setConfirm(null); }} />}
    </div>
  );
}

// ─── HORARIOS ─────────────────────────────────────────────────────────────────
function VistaHorarios({ materias }) {
  const cur = materias.filter(m => ["cursando", "regular"].includes(m.estado) && m.dias?.length > 0);
  const [vistaGrid, setVistaGrid] = useState(false);

  const entradas = cur.flatMap(m =>
    (m.dias || []).map(dia => {
      const str = m.horarios?.[dia] || m.horario || "12:00";
      const [start, end] = str.includes("-") ? str.split("-") : [str, null];
      return { materia: m, dia, hora: start, horaFin: end };
    })
  ).sort((a, b) => a.hora.localeCompare(b.hora));

  // Vista por día (default)
  const porDia = DIAS_SEMANA.map(dia => ({
    dia,
    clases: entradas.filter(e => e.dia === dia).sort((a, b) => a.hora.localeCompare(b.hora))
  })).filter(d => d.clases.length > 0);

  // Vista grilla
  const getSlotIdx = (t) => {
    if (!t) return 0;
    const [h, m] = t.split(":").map(Number);
    return h * 2 + (m === 30 ? 1 : 0);
  };
  const tiempos = [...new Set(entradas.flatMap(e => [e.hora, e.horaFin]).filter(Boolean))].sort();
  const horasAMostrar = tiempos.length > 0 ? HORAS.filter(h => {
    const idx = HORAS.indexOf(h);
    const indices = tiempos.map(x => HORAS.indexOf(x)).filter(x => x >= 0);
    if (!indices.length) return false;
    const min = Math.max(0, Math.min(...indices) - 1);
    const max = Math.min(HORAS.length - 1, Math.max(...indices)); 
    return idx >= min && idx <= max;
  }) : HORAS;

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      
      {/* HEADER PREMIUM */}
      <div className="card" style={{ padding: "16px 20px", background: "linear-gradient(135deg,var(--surface),var(--surface2))", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 44, height: 44, background: "var(--blue-dim)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon name="horarios" size={22} color="var(--blue)" />
        </div>
        <div>
          <h2 style={{ fontFamily: "'Barlow Condensed'", fontSize: 22, fontWeight: 800, lineHeight: 1 }}>HORARIO SEMANAL</h2>
          <p style={{ fontSize: 11, color: "var(--text3)", marginTop: 3 }}>{cur.length} materias cursando · {entradas.length} clases por semana</p>
        </div>
      </div>

      {/* Toggle de vista */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <p className="section-title" style={{ margin: 0 }}>Mi agenda de clases</p>
        <div style={{ display: "flex", gap: 4, background: "var(--surface2)", borderRadius: 8, padding: 4, width: "fit-content" }}>
          {[{ id: false, label: "Por día", icon: "list" }, { id: true, label: "Grilla", icon: "grid" }].map(v => (
            <button key={String(v.id)} onClick={() => setVistaGrid(v.id)} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 14px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 600,
              background: vistaGrid === v.id ? "var(--surface)" : "transparent",
              color: vistaGrid === v.id ? "var(--blue)" : "var(--text2)", transition: "all 0.15s",
              boxShadow: vistaGrid === v.id ? "0 2px 8px rgba(0,0,0,0.2)" : "none"
            }}><Icon name={v.icon} size={14} />{v.label}</button>
          ))}
        </div>
      </div>

      {cur.length === 0 && (
        <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text2)", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="horarios" size={24} /></div>
          <span style={{ fontSize: 13 }}>No hay materias con horario cargado todavía. Editá tus materias para agregarles días y horarios de cursado.</span>
        </div>
      )}

      {/* ── VISTA POR DÍA (TIMELINE) ── */}
      {!vistaGrid && cur.length > 0 && (
        porDia.length === 0 ? (
          <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--text2)", fontSize: 13 }}>
            Agregá días a tus materias para ver el horario
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
            {porDia.map(({ dia, clases }) => (
              <div key={dia} className="card" style={{ padding: 0, overflow: "hidden", background: "var(--surface)" }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "'Barlow Condensed'", fontSize: 15, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase" }}>{dia}</span>
                  <span className="tag" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>{clases.length} clase{clases.length !== 1 ? "s" : ""}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "14px 16px" }}>
                  {clases.map((e, i) => {
                    const est = ESTADOS[e.materia.estado];
                    return (
                      <div key={i} style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", display: "flex", alignItems: "center", gap: 12, position: "relative", overflow: "hidden", transition: "transform 0.15s", cursor: "default" }} onMouseEnter={ev => ev.currentTarget.style.transform = "translateX(2px)"} onMouseLeave={ev => ev.currentTarget.style.transform = "translateX(0)"}>
                        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: est.color }} />
                        <div style={{ background: "var(--surface)", padding: "6px 8px", borderRadius: 6, display: "flex", flexDirection: "column", alignItems: "center", minWidth: 46, border: "1px solid var(--border)" }}>
                          <span style={{ fontFamily: "'DM Mono'", fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{e.hora}</span>
                          {e.horaFin && <span style={{ fontFamily: "'DM Mono'", fontSize: 9, color: "var(--text3)", marginTop: 1 }}>a {e.horaFin}</span>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0, paddingLeft: 2 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.materia.nombre}</div>
                          <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 4, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            {e.materia.aula ? <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Icon name="dashboard" size={10} /> Aula {e.materia.aula}</span> : null}
                            <span className="tag" style={{ background: est.bg, color: est.color, padding: "2px 6px" }}>{est.label}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── VISTA GRILLA VISUAL ── */}
      {vistaGrid && cur.length > 0 && (
        <div className="card" style={{ overflowX: "auto", background: "var(--surface)", padding: 0 }}>
          <div style={{ minWidth: 720 }}>
            {/* Header de días */}
            <div style={{ display: "grid", gridTemplateColumns: "60px repeat(6,1fr)", borderBottom: "1px solid var(--border)", background: "var(--surface2)" }}>
              <div />
              {DIAS_SEMANA.map((d, i) => (
                <div key={d} style={{ padding: "12px 0", textAlign: "center", fontFamily: "'Barlow Condensed'", fontSize: 13, fontWeight: 800, letterSpacing: 1, color: "var(--text2)", borderLeft: i === 0 ? "none" : "1px solid var(--border)" }}>{d}</div>
              ))}
            </div>
            
            {/* Cuerpo de la grilla (Time blocks overlay) */}
            <div style={{ display: "grid", gridTemplateColumns: "60px repeat(6,1fr)", gridAutoRows: "minmax(34px, auto)", position: "relative" }}>
              
              {/* 1) Líneas de fondo y horas */}
              {horasAMostrar.map((hora, rowIdx) => (
                <div style={{ display: "contents" }} key={`bg-${hora}`}>
                  {/* Etiqueta de la hora */}
                  <div style={{ gridColumn: 1, gridRow: rowIdx + 1, borderBottom: rowIdx === horasAMostrar.length - 1 ? "none" : "1px solid var(--border)", borderRight: "1px solid var(--border)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 8, fontFamily: "'DM Mono'", fontSize: 11, color: "var(--text3)", background: "var(--surface2)", zIndex: 1 }}>
                    {hora}
                  </div>
                  {/* Celdas vacías para formar la grilla */}
                  {DIAS_SEMANA.map((dia, colIdx) => (
                    <div key={`cell-${dia}-${hora}`} style={{ gridColumn: colIdx + 2, gridRow: rowIdx + 1, borderBottom: rowIdx === horasAMostrar.length - 1 ? "none" : "1px solid var(--border)", borderRight: colIdx === 5 ? "none" : "1px solid var(--border)", background: "var(--surface)", zIndex: 0 }} />
                  ))}
                </div>
              ))}

              {/* 2) Bloques de materias (Flotando sobre la grilla) */}
              {entradas.map((e, i) => {
                const startIdx = horasAMostrar.indexOf(e.hora);
                if (startIdx === -1) return null;

                let endIdx = e.horaFin ? horasAMostrar.indexOf(e.horaFin) : -1;
                if (endIdx === -1) {
                  const diff = (getSlotIdx(e.horaFin || "00:00") - getSlotIdx(e.hora)) || 4; // default 2 hrs
                  endIdx = startIdx + Math.max(1, diff);
                }

                const m = e.materia;
                const est = ESTADOS[m.estado];
                const col = DIAS_SEMANA.indexOf(e.dia) + 2;

                return (
                  <div key={`block-${e.dia}-${e.hora}-${i}`} style={{ 
                    gridColumn: col, 
                    gridRow: `${startIdx + 1} / ${endIdx + 1}`,
                    padding: "3px 5px", // Separación de los bordes de la celda
                    zIndex: 10
                  }}>
                    <div className="fade-in" style={{ 
                      background: est.bg, 
                      border: `1px solid ${est.color}44`, 
                      borderRadius: 6, 
                      padding: "6px 8px", 
                      height: "100%", 
                      display: "flex", 
                      flexDirection: "column", 
                      gap: 4, 
                      position: "relative", 
                      overflow: "hidden",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                      cursor: "default",
                      transition: "transform 0.15s, border-color 0.15s"
                    }} onMouseEnter={ev => ev.currentTarget.style.borderColor = est.color} onMouseLeave={ev => ev.currentTarget.style.borderColor = `${est.color}44`}>
                      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: est.color }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", lineHeight: 1.2, marginLeft: 2, display: "-webkit-box", WebkitLineClamp: Math.max(1, Math.floor((endIdx - startIdx) * 1.5)), WebkitBoxOrient: "vertical", overflow: "hidden" }}>{m.nombre}</span>
                      {(endIdx - startIdx) >= 2 && m.aula && <span style={{ fontSize: 9, color: "var(--text)", background: "rgba(0,0,0,0.25)", padding: "2px 5px", borderRadius: 4, width: "fit-content", marginLeft: 2 }}>Aula {m.aula}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {cur.length > 0 && (
        <div style={{ marginTop: 8 }}><p className="section-title">Referencias</p>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {Object.entries(ESTADOS).filter(([k]) => ["cursando", "regular"].includes(k)).map(([k, v]) => (
              <span key={k} className="tag" style={{ background: v.bg, color: v.color, padding: "4px 8px" }}>{v.label}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── VISTA MAPA (MALLA CURRICULAR) ────────────────────────────────────────────
function VistaMapa({ materias, onAdd }) {
  const [loading, setLoading] = useState(false);
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  const importarFaltantes = async () => {
    if (!confirm("¿Querés cargar todas las materias del plan que te faltan como 'Pendientes'?")) return;
    setLoading(true);
    let cont = 0;
    for (const año of PLAN_ESTUDIO) {
      for (const mPlan of año.materias) {
        const existe = materias.some(x => norm(x.nombre) === norm(mPlan.nombre));
        if (!existe) {
          await onAdd({
            nombre: mPlan.nombre,
            año: año.año,
            cuatrimestre: mPlan.c === 0 ? 1 : mPlan.c,
            estado: "pendiente",
            nota: null,
            hs: 4,
            dias: [],
            horarios: {},
            aula: ""
          });
          cont++;
        }
      }
    }
    alert(`Se cargaron ${cont} materias nuevas.`);
    setLoading(false);
  };

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <p style={{ fontSize: 13, color: "var(--text2)" }}>Visualización de tu progreso según el plan de estudios oficial.</p>
        <button className="btn-ghost" onClick={importarFaltantes} disabled={loading} style={{ fontSize: 12, borderColor: "var(--blue)", color: "var(--blue)" }}>
          {loading ? "Cargando..." : "Cargar materias faltantes del plan"}
        </button>
      </div>

      {PLAN_ESTUDIO.map(año => (
        <div key={año.año}>
          <p className="section-title">Año {año.año}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
            {año.materias.map(mPlan => {
              const mUser = materias.find(x => norm(x.nombre) === norm(mPlan.nombre));
              const est = mUser ? ESTADOS[mUser.estado] : null;
              return (
                <div key={mPlan.id} className="card" style={{
                  padding: "12px 14px",
                  border: mUser ? `1px solid ${est.color}44` : "1px solid var(--border)",
                  background: mUser ? est.bg : "var(--surface)",
                  position: "relative", overflow: "hidden",
                  display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 84
                }}>
                  {mUser && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: est.color }} />}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: mUser ? est.color : "var(--text3)", marginBottom: 4 }}>
                      {mPlan.c === 0 ? "ANUAL" : `${mPlan.c}° CUAT`}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, color: mUser ? "var(--text)" : "var(--text2)" }}>{mPlan.nombre}</div>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    {mUser ? (
                      <span className="tag" style={{ background: est.bg, color: est.color, padding: "1px 6px", border: `1px solid ${est.color}33` }}>
                        {est.label} {mUser.nota ? `(${mUser.nota})` : ""}
                      </span>
                    ) : (
                      <span style={{ fontSize: 10, color: "var(--text3)", fontStyle: "italic" }}>Pendiente</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="card" style={{ padding: 16, background: "var(--surface2)" }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Leyenda de estados</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Object.entries(ESTADOS).map(([k, v]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: v.color }} />
              <span style={{ fontSize: 11, color: "var(--text2)" }}>{v.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── IMPORTADOR IA ────────────────────────────────────────────────────────────
function ImportadorIA({ materias, onImportar, onClose }) {
  const [texto, setTexto] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null); // array de eventos parseados
  const [seleccionados, setSeleccionados] = useState([]);
  const [err, setErr] = useState("");

  const parsear = async () => {
    if (!texto.trim()) return;
    setLoading(true); setErr(""); setResultado(null);
    const hoy = new Date().toISOString().split("T")[0];
    const listaMaterias = materias.map(m => `- ${m.nombre} (id: ${m.id})`).join("\n");
    const system = `Sos un parser de calendarios académicos universitarios argentinos. Tu única función es extraer eventos del texto que te dan y devolver un JSON válido. No expliques nada, no agregues texto, solo devolvé el JSON.

Materias disponibles:
${listaMaterias}

Hoy es ${hoy}. El año actual es ${new Date().getFullYear()}.

Devolvé SOLO un array JSON con este formato exacto, sin texto adicional:
[
  {
    "titulo": "nombre del evento",
    "tipo": "parcial|final|tp|otro",
    "fecha": "YYYY-MM-DD",
    "hora": "HH:MM",
    "descripcion": "temas o info adicional",
    "materia_id": "uuid de la materia o null si no se puede determinar"
  }
]

Reglas:
- Si no podés determinar la materia, poné materia_id: null
- Si no hay hora, poné "09:00"
- Solo devolvé eventos con fecha válida
- Interpretá "primer parcial", "1er parcial", "parcial 1" como tipo "parcial"
- Interpretá "final", "examen final" como tipo "final"
- Interpretá "TP", "trabajo práctico" como tipo "tp"`;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system,
          messages: [{ role: "user", content: texto }],
          modelo: "claude",
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const txt = data.text.trim();
      const clean = txt.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("No se encontraron eventos en el texto");
      setResultado(parsed);
      setSeleccionados(parsed.map((_, i) => i));
    } catch (e) {
      setErr(`No se pudo parsear: ${e.message}`);
    }
    setLoading(false);
  };

  const toggleSel = i => setSeleccionados(s => s.includes(i) ? s.filter(x => x !== i) : [...s, i]);

  const confirmar = () => {
    const evs = seleccionados.map(i => resultado[i]);
    onImportar(evs);
    onClose();
  };

  const tipoColor = t => TIPO_EVENTO[t]?.color || "var(--text2)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {!resultado ? <>
        <div>
          <Lbl>Pegá el texto del SIU, calendario o cualquier texto con fechas académicas</Lbl>
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            rows={8}
            style={{ width: "100%", resize: "vertical", fontSize: 13, lineHeight: 1.5, padding: "10px 12px", borderRadius: 7 }}
            placeholder={`Ejemplos de lo que podés pegar:\n\n• "1er Parcial Análisis II: 15/05 a las 14hs - Temas: integrales"\n• Texto copiado del SIU con fechas de finales\n• El calendario del cuatrimestre copiado de la web\n• Cualquier texto con fechas y materias`}
          />
        </div>
        {err && <div style={{ fontSize: 12, color: "var(--red)", background: "rgba(192,80,77,0.1)", padding: "8px 12px", borderRadius: 6 }}>{err}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-primary" style={{ flex: 1, justifyContent: "center", opacity: loading || !texto.trim() ? 0.6 : 1 }}
            onClick={parsear} disabled={loading || !texto.trim()}>
            {loading ? <>
              <span className="pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", display: "inline-block" }} />
              Analizando...
            </> : "Analizar texto"}
          </button>
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
        </div>
      </> : <>
        <div>
          <p className="section-title">Eventos detectados — seleccioná los que querés importar</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {resultado.map((ev, i) => {
              const mat = materias.find(m => m.id === ev.materia_id);
              const sel = seleccionados.includes(i);
              return (
                <div key={i} onClick={() => toggleSel(i)} style={{
                  padding: "11px 14px", borderRadius: 8, cursor: "pointer",
                  border: `1px solid ${sel ? tipoColor(ev.tipo) : "var(--border)"}`,
                  background: sel ? `${tipoColor(ev.tipo)}0e` : "var(--surface2)",
                  display: "flex", alignItems: "center", gap: 12, transition: "all 0.15s"
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                    border: `2px solid ${sel ? tipoColor(ev.tipo) : "var(--border)"}`,
                    background: sel ? tipoColor(ev.tipo) : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    {sel && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{ev.titulo}</span>
                      <span className="tag" style={{ background: `${tipoColor(ev.tipo)}18`, color: tipoColor(ev.tipo) }}>
                        {TIPO_EVENTO[ev.tipo]?.label || ev.tipo}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text2)", display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <span>{ev.fecha} · {ev.hora}</span>
                      {mat ? <span style={{ color: "var(--blue)" }}>{mat.nombre}</span> : <span style={{ color: "var(--red)" }}>Sin materia asignada</span>}
                      {ev.descripcion && <span>{ev.descripcion}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-primary" style={{ flex: 1, justifyContent: "center", opacity: seleccionados.length === 0 ? 0.5 : 1 }}
            onClick={confirmar} disabled={seleccionados.length === 0}>
            Importar {seleccionados.length} evento{seleccionados.length !== 1 ? "s" : ""}
          </button>
          <button className="btn-ghost" onClick={() => setResultado(null)}>Volver</button>
        </div>
      </>}
    </div>
  );
}

// ─── EVENTOS ──────────────────────────────────────────────────────────────────
function FormEvento({ materias, initial, onSave, onClose }) {
  const [f, setF] = useState(initial || { materia_id: materias[0]?.id || "", tipo: "parcial", titulo: "", fecha: "", hora: "09:00", descripcion: "" });
  const [errs, setErrs] = useState({});
  const s = (k, v) => setF(p => ({ ...p, [k]: v }));
  const validar = () => {
    const e = {};
    if (!f.titulo || f.titulo.trim().length < 3) e.titulo = "El título debe tener al menos 3 caracteres";
    if (!f.fecha) e.fecha = "La fecha es requerida";
    setErrs(e);
    return Object.keys(e).length === 0;
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
      <div><Lbl>Materia</Lbl><select style={{ width: "100%" }} value={f.materia_id} onChange={e => s("materia_id", e.target.value)}>{materias.filter(m => ["cursando", "regular"].includes(m.estado)).map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
        <div><Lbl>Tipo</Lbl><select style={{ width: "100%" }} value={f.tipo} onChange={e => s("tipo", e.target.value)}>{Object.entries(TIPO_EVENTO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
        <div>
          <Lbl>Fecha</Lbl>
          <input type="date" style={{ width: "100%", colorScheme: "dark", borderColor: errs.fecha ? "var(--red)" : undefined }} value={f.fecha} onChange={e => { s("fecha", e.target.value); setErrs(p => ({ ...p, fecha: "" })); }} />
          {errs.fecha && <div className="field-error">{errs.fecha}</div>}
        </div>
      </div>
      <div>
        <Lbl>Título</Lbl>
        <input style={{ width: "100%", borderColor: errs.titulo ? "var(--red)" : undefined }} value={f.titulo} onChange={e => { s("titulo", e.target.value); setErrs(p => ({ ...p, titulo: "" })); }} placeholder="Ej: 1er Parcial" />
        {errs.titulo && <div className="field-error">{errs.titulo}</div>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
        <div><Lbl>Hora</Lbl><select style={{ width: "100%" }} value={f.hora} onChange={e => s("hora", e.target.value)}>{HORAS.map(h => <option key={h}>{h}</option>)}</select></div>
        <div><Lbl>Descripción</Lbl><input style={{ width: "100%" }} value={f.descripcion} onChange={e => s("descripcion", e.target.value)} placeholder="Temas, etc." /></div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button className="btn-primary" style={{ flex: 1 }} onClick={() => { if (validar()) { localStorage.removeItem("utn_draft_evento"); onSave(f); } }}>{initial ? "Guardar" : "Agregar evento"}</button>
        <button className="btn-ghost" onClick={() => { localStorage.removeItem("utn_draft_evento"); onClose(); }}>Cancelar</button>
      </div>
    </div>
  );
}

// ─── VISTA TAREAS (CHECKLIST) ────────────────────────────────────────────────
function VistaTareas({ materias, tareas, onAdd, onToggle, onDelete }) {
  const [nueva, setNueva] = useState("");
  const [matId, setMatId] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nueva.trim()) return;
    onAdd({ titulo: nueva, materia_id: matId || null, completada: false });
    setNueva("");
  };

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <form className="card" onSubmit={handleSubmit} style={{ padding: 14, background: "var(--surface2)", border: "1px dashed var(--border)" }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", marginBottom: 8 }}>Agregar tarea rápida</p>
        <div style={{ display: "flex", gap: 8 }}>
          <input style={{ flex: 1 }} value={nueva} onChange={e => setNueva(e.target.value)} placeholder="Ej: Estudiar unidad 3..." />
          <select style={{ width: 140 }} value={matId} onChange={setMatId && (e => setMatId(e.target.value))}>
            <option value="">General</option>
            {materias.filter(m => ["cursando", "regular"].includes(m.estado)).map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
          <button className="btn-primary" type="submit" style={{ padding: "0 14px" }}><Icon name="plus" size={14} color="#fff" /></button>
        </div>
      </form>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {tareas.length === 0 ? (
          <div style={{ textAlign: "center", padding: 20, color: "var(--text3)", fontSize: 13 }}>No hay tareas pendientes.</div>
        ) : (
          tareas.sort((a, b) => a.completada - b.completada).map(t => {
            const m = materias.find(x => x.id === t.materia_id);
            return (
              <div key={t.id} className="card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, opacity: t.completada ? 0.6 : 1 }}>
                <input type="checkbox" checked={t.completada} onChange={() => onToggle(t.id, !t.completada)} style={{ width: 18, height: 18, cursor: "pointer" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, textDecoration: t.completada ? "line-through" : "none", color: t.completada ? "var(--text3)" : "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.titulo}</div>
                  {m && <div style={{ fontSize: 10, color: "var(--blue)", fontWeight: 600 }}>{m.nombre}</div>}
                </div>
                <button className="btn-danger" style={{ padding: "5px 8px", opacity: 0.5, border: "none", background: "transparent" }} onClick={() => onDelete(t.id)}><Icon name="trash" size={12} color="var(--red)" /></button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function VistaEventos({ materias, eventos, tareas, onAdd, onEdit, onDelete, onAddTarea, onToggleTarea, onDeleteTarea }) {
  const [subVista, setSubVista] = useState("calendario"); // 'lista' | 'calendario'
  const [edit, setEdit] = useState(null);
  const [add, setAdd] = useState(() => !!localStorage.getItem("utn_draft_evento"));
  const [importar, setImportar] = useState(false);
  const [ft, setFt] = useState("all");
  const [confirm, setConfirm] = useState(null);
  const [fechaSel, setFechaSel] = useState(new Date());

  const hoy = new Date();
  const fil = useMemo(() => eventos.filter(e => ft === "all" || e.tipo === ft).sort((a, b) => new Date(a.fecha) - new Date(b.fecha)), [eventos, ft]);
  const prox = fil.filter(e => new Date(e.fecha) >= hoy);
  const pas = fil.filter(e => new Date(e.fecha) < hoy);

  // Lógica de Calendario Mensual
  const diasMes = useMemo(() => {
    const año = fechaSel.getFullYear();
    const mes = fechaSel.getMonth();
    const primerDia = new Date(año, mes, 1).getDay(); // 0=Dom, 1=Lun...
    const ultimoDia = new Date(año, mes + 1, 0).getDate();
    const dias = [];
    // Ajuste para que empiece en Lunes (si querés que empiece en domingo, sacá el ajuste)
    const start = primerDia === 0 ? 6 : primerDia - 1;
    for (let i = 0; i < start; i++) dias.push(null);
    for (let i = 1; i <= ultimoDia; i++) dias.push(new Date(año, mes, i));
    return dias;
  }, [fechaSel]);

  const irMes = (n) => setFechaSel(new Date(fechaSel.getFullYear(), fechaSel.getMonth() + n, 1));

  const Row = ({ ev }) => {
    const mat = materias.find(m => m.id === ev.materia_id);
    const tipo = TIPO_EVENTO[ev.tipo];
    const past = new Date(ev.fecha) < hoy;
    const d = Math.ceil((new Date(ev.fecha + "T00:00:00") - new Date(hoy.toISOString().split("T")[0] + "T00:00:00")) / 86400000);
    const lbl = past ? "Pasado" : d === 0 ? "Hoy" : d === 1 ? "Mañana" : `${d}d`;
    return (
      <div className="card" style={{ padding: "11px 14px", display: "flex", alignItems: "center", gap: 11, opacity: past ? 0.45 : 1 }}>
        <div style={{ width: 3, height: 36, borderRadius: 2, background: tipo.color, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{ev.titulo}</span>
            <span className="tag" style={{ background: `${tipo.color}18`, color: tipo.color }}>{tipo.label}</span>
          </div>
          <span style={{ fontSize: 11, color: "var(--text2)" }}>{mat?.nombre}{ev.descripcion && ` · ${ev.descripcion}`}</span>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0, minWidth: 64 }}>
          <div style={{ fontFamily: "'DM Mono'", fontSize: 12, color: past ? "var(--text3)" : "var(--blue)", fontWeight: 500 }}>{lbl}</div>
          <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 1 }}>{new Date(ev.fecha + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "2-digit" })} · {ev.hora}</div>
        </div>
        <div style={{ display: "flex", gap: 5 }}>
          <button className="btn-ghost" style={{ padding: "5px 8px" }} onClick={() => setEdit(ev)}><Icon name="edit" size={13} /></button>
          <button className="btn-danger" onClick={() => setConfirm({ id: ev.id, nombre: ev.titulo })}><Icon name="trash" size={13} /></button>
        </div>
      </div>
    );
  };

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 13 }}>
      {/* Selector de sub-vista */}
      <div style={{ display: "flex", gap: 1, background: "var(--surface2)", borderRadius: 7, padding: 3, width: "fit-content" }}>
        {[{ id: "calendario", label: "Calendario" }, { id: "lista", label: "Lista" }, { id: "tareas", label: "Tareas" }].map(v => (
          <button key={v.id} onClick={() => setSubVista(v.id)} style={{
            padding: "5px 16px", borderRadius: 5, border: "none", fontSize: 12, fontWeight: 600,
            background: subVista === v.id ? "var(--blue)" : "transparent",
            color: subVista === v.id ? "#fff" : "var(--text2)", transition: "all 0.15s"
          }}>{v.label}</button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 5, flex: 1, flexWrap: "wrap" }}>
          {["all", ...Object.keys(TIPO_EVENTO)].map(k => { const t = k === "all" ? null : TIPO_EVENTO[k]; const ac = ft === k; return <button key={k} onClick={() => setFt(k)} style={{ padding: "3px 10px", borderRadius: 4, fontSize: 11, fontWeight: 500, border: `1px solid ${ac ? (t?.color || "var(--blue)") : "var(--border)"}`, background: ac ? (t ? `${t.color}18` : "var(--blue-dim)") : "transparent", color: ac ? (t?.color || "var(--blue)") : "var(--text2)", transition: "all 0.15s" }}>{k === "all" ? "Todos" : t.label}</button>; })}
        </div>
        <button className="btn-ghost" style={{ fontSize: 13 }} onClick={() => setImportar(true)}>Importar desde texto</button>
        <button className="btn-primary" onClick={() => setAdd(true)}><Icon name="plus" size={14} color="#fff" />Agregar</button>
      </div>

      {subVista === "calendario" ? (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <button className="btn-ghost" onClick={() => irMes(-1)}><Icon name="chevronL" size={14} /></button>
            <span style={{ fontFamily: "'Barlow Condensed'", fontSize: 18, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1 }}>
              {fechaSel.toLocaleDateString("es-AR", { month: "long", year: "numeric" })}
            </span>
            <button className="btn-ghost" onClick={() => irMes(1)}><Icon name="chevronR" size={14} /></button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {["L", "M", "X", "J", "V", "S", "D"].map(d => (
              <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--text3)", paddingBottom: 8 }}>{d}</div>
            ))}
            {diasMes.map((d, i) => {
              if (!d) return <div key={`empty-${i}`} style={{ aspectRatio: "1/1" }} />;
              const fIso = d.toISOString().split("T")[0];
              const evsHoy = eventos.filter(e => e.fecha === fIso);
              const esHoy = fIso === hoy.toISOString().split("T")[0];
              return (
                <div key={i} style={{
                  aspectRatio: "1/1", background: esHoy ? "var(--blue-dim)" : "var(--surface2)",
                  border: `1px solid ${esHoy ? "var(--blue)" : "var(--border)"}`,
                  borderRadius: 6, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  position: "relative", cursor: "pointer"
                }} onClick={() => {
                  setSubVista("lista");
                }}>
                  <span style={{ fontSize: 12, fontWeight: esHoy ? 700 : 400, color: esHoy ? "var(--blue)" : "var(--text)" }}>{d.getDate()}</span>
                  <div style={{ display: "flex", gap: 2, marginTop: 4, flexWrap: "wrap", justifyContent: "center" }}>
                    {evsHoy.map(e => (
                      <div key={e.id} style={{ width: 4, height: 4, borderRadius: "50%", background: TIPO_EVENTO[e.tipo]?.color || "var(--blue)" }} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : subVista === "tareas" ? (
        <VistaTareas materias={materias} tareas={tareas} onAdd={onAddTarea} onToggle={onToggleTarea} onDelete={onDeleteTarea} />
      ) : (
        <>
          {prox.length > 0 && <><p className="section-title">Próximos ({prox.length})</p><div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{prox.map(ev => <Row key={ev.id} ev={ev} />)}</div></>}
          {pas.length > 0 && <><p className="section-title" style={{ marginTop: 8 }}>Pasados ({pas.length})</p><div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{pas.map(ev => <Row key={ev.id} ev={ev} />)}</div></>}
          {fil.length === 0 && <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--text2)", fontSize: 13 }}>Sin eventos</div>}
        </>
      )}

      {add && <Modal title="Nuevo Evento" onClose={() => setAdd(false)}><FormEvento materias={materias} onSave={f => { onAdd(f); setAdd(false); }} onClose={() => setAdd(false)} /></Modal>}
      {edit && <Modal title="Editar Evento" onClose={() => setEdit(null)}><FormEvento materias={materias} initial={edit} onSave={f => { onEdit(edit.id, f); setEdit(null); }} onClose={() => setEdit(null)} /></Modal>}
      {importar && <Modal title="Importar eventos desde texto" onClose={() => setImportar(false)} width={600}>
        <ImportadorIA materias={materias} onImportar={evs => { evs.forEach(ev => onAdd(ev)); }} onClose={() => setImportar(false)} />
      </Modal>}
      {confirm && <ConfirmModal nombre={confirm.nombre} onClose={() => setConfirm(null)} onConfirm={() => { onDelete(confirm.id); setConfirm(null); }} />}
    </div>
  );
}

function VistaArchivos({ materias, archivos, carpetas, userId, showToast, onAskIA, onRefresh }) {
  const [nav, setNav] = useState(null);
  const [upFiles, setUpFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [confirmC, setConfirmC] = useState(null);
  const [newFolder, setNewFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [busq, setBusq] = useState("");
  const [view, setView] = useState(() => localStorage.getItem("utn_av") || "list");
  const [renamingId, setRenamingId] = useState(null);
  const [renameVal, setRenameVal] = useState("");
  const [moving, setMoving] = useState(null);
  const isMain = userId === MAIN_USER_ID;
  const sv = m => { setView(m); localStorage.setItem("utn_av", m); };

  const fT = b => b > 1e6 ? `${(b/1e6).toFixed(1)}MB` : b > 1e3 ? `${(b/1e3).toFixed(0)}KB` : `${b}B`;
  const fD = d => d ? new Date(d).toLocaleDateString("es-AR", { day:"2-digit", month:"short" }) : "";
  const fEmoji = t => ({PDF:"📄",DOCX:"📝",DOC:"📝",XLSX:"📊",XLS:"📊",PPTX:"📈",PNG:"🖼️",JPG:"🖼️",JPEG:"🖼️",ZIP:"📦",RAR:"📦",MP4:"🎬",MP3:"🎵",TXT:"📃",PY:"🐍",JS:"📜",TS:"📜",HTML:"🌐",CSS:"🎨"})[t] || "📎";
  const tC = t => ({PDF:"#e63946",DOCX:"#2b579a",DOC:"#2b579a",XLSX:"#217346",XLS:"#217346",PPTX:"#d24726",PNG:"#f77f00",JPG:"#f77f00",JPEG:"#f77f00",ZIP:"#f4a261",RAR:"#f4a261"})[t] || "var(--slate)";

  const subir = async (files, materiaId, carpetaId = null) => {
    if (!navigator.onLine) { showToast("Necesitás conexión a internet para subir archivos."); return; }
    const arr = Array.from(files);
    setUpFiles(arr.map(f => ({ name: f.name, pct: 0, done: false, err: null })));
    setUploading(true);
    for (let i = 0; i < arr.length; i++) {
      const f = arr[i];
      const upd = p => setUpFiles(prev => prev.map((x, j) => j === i ? { ...x, ...p } : x));
      upd({ pct: 20 });
      try {
        const ext = f.name.split(".").pop().toUpperCase();
        upd({ pct: 50 });
        const res = await fetch("/api/upload", { 
          method: "POST", 
          headers: {
            "x-file-name": encodeURIComponent(f.name),
            "x-user-id": userId,
            "content-type": f.type || "application/octet-stream"
          },
          body: f 
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        if (!res.ok) throw new Error(data.message || "Error al subir");
        upd({ pct: 80 });
        const { error: insErr } = await ejecutar(sb.from("archivos").insert({
          user_id: userId,
          materia_id: materiaId,
          carpeta_id: carpetaId,
          nombre: f.name,
          tipo: ext,
          tamaño: f.size,
          storage_path: data.key
        }));
        if (insErr) throw new Error(insErr);
        upd({ pct: 100, done: true });
      } catch (e) { upd({ err: e.message, pct: 100, done: true }); showToast(`Error: ${e.message}`); }
    }
    setTimeout(() => { setUpFiles([]); setUploading(false); onRefresh(); }, 1800);
  };

  const eliminar = async (a) => {
    if (a.storage_path) {
      await fetch(`/api/upload?key=${encodeURIComponent(a.storage_path)}`, { method: "DELETE" });
    }
    const { error } = await ejecutar(sb.from("archivos").delete().eq("id", a.id));
    if (error) { showToast(error); return; }
    onRefresh();
  };

  const descargar = async (a) => {
    try {
      const res = await fetch(`/api/upload?key=${encodeURIComponent(a.storage_path)}`);
      const { url, error } = await res.json();
      if (error) throw new Error(error);
      window.open(url, "_blank");
    } catch (e) { showToast(e.message); }
  };


  const crearCarpeta = async () => {
    if (!folderName.trim() || !nav?.id) return;
    const { error } = await ejecutar(sb.from("carpetas").insert({ user_id: userId, nombre: folderName.trim(), materia_id: nav.id }));
    if (error) { showToast(error); return; }
    setFolderName(""); setNewFolder(false); onRefresh();
  };

  const eliminarCarpeta = async c => {
    const { error: e1 } = await ejecutar(sb.from("archivos").update({ carpeta_id: null }).eq("carpeta_id", c.id));
    if (e1) { showToast(e1); return; }
    const { error } = await ejecutar(sb.from("carpetas").delete().eq("id", c.id));
    if (error) { showToast(error); return; }
    if (nav?.id === c.id) setNav({ tipo: "materia", id: c.materia_id });
    onRefresh();
  };

  const renombrarCarpeta = async c => {
    if (!renameVal.trim()) { setRenamingId(null); return; }
    const { error } = await ejecutar(sb.from("carpetas").update({ nombre: renameVal.trim() }).eq("id", c.id));
    if (error) { showToast(error); return; }
    setRenamingId(null); onRefresh();
  };

  const moverArchivo = async (a, cid) => {
    const { error } = await ejecutar(sb.from("archivos").update({ carpeta_id: cid === "null" ? null : cid }).eq("id", a.id));
    if (error) { showToast(error); return; }
    setMoving(null); onRefresh();
  };

  const togglePublico = async a => {
    const { error } = await ejecutar(sb.from("archivos").update({ es_publico: !a.es_publico }).eq("id", a.id));
    if (error) { showToast(error); return; }
    onRefresh();
  };

  // Panel progreso upload flotante
  const UpPanel = () => upFiles.length === 0 ? null : (
    <div style={{ position: "fixed", bottom: 80, right: 20, zIndex: 100, background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 12, padding: 16, width: 290, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
        <Icon name="upload" size={13} color="var(--blue)" />
        {upFiles.filter(f => f.done).length}/{upFiles.length} archivos subidos
      </div>
      {upFiles.map((f, i) => (
        <div key={i} style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 210 }}>{f.name}</span>
            <span style={{ color: f.err ? "var(--red)" : f.done ? "var(--green)" : "var(--blue)", flexShrink: 0, marginLeft: 6 }}>{f.err ? "✗" : f.done ? "✓" : `${f.pct}%`}</span>
          </div>
          <div style={{ height: 3, background: "var(--surface3)", borderRadius: 2 }}>
            <div style={{ height: "100%", width: `${f.pct}%`, background: f.err ? "var(--red)" : f.done ? "var(--green)" : "var(--blue)", borderRadius: 2, transition: "width 0.3s" }} />
          </div>
        </div>
      ))}
    </div>
  );

  const SubirBtn = ({ materiaId, carpetaId = null }) => (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--blue)", color: "#fff", borderRadius: "var(--radius)", padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: uploading ? "wait" : "pointer", opacity: uploading ? 0.6 : 1 }}>
      <Icon name="upload" size={14} color="#fff" />
      {uploading ? "Subiendo..." : "Subir archivo"}
      <input type="file" multiple style={{ display: "none" }} onChange={e => subir(e.target.files, materiaId, carpetaId)} disabled={uploading} />
    </label>
  );

  const DropZone = ({ materiaId, carpetaId = null }) => (
    <div onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); subir(e.dataTransfer.files, materiaId, carpetaId); }}
      style={{ border: `2px dashed ${drag ? "var(--blue)" : "var(--border2)"}`, borderRadius: 12, padding: "28px 20px", textAlign: "center", background: drag ? "var(--blue-dim)" : "var(--surface2)", transition: "all 0.2s" }}>
      <div style={{ fontSize: 28, marginBottom: 6 }}>📂</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: drag ? "var(--blue)" : "var(--text2)" }}>{drag ? "¡Soltá acá!" : "Arrastrá archivos aquí"}</div>
      <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 3 }}>o usá el botón "Subir archivo"</div>
    </div>
  );

  const VT = () => (
    <div style={{ display: "flex", gap: 2, background: "var(--surface3)", borderRadius: 6, padding: 2 }}>
      {[["list", "list"], ["grid", "grid"]].map(([m, ic]) => (
        <button key={m} onClick={() => sv(m)} style={{ padding: "5px 9px", border: "none", borderRadius: 5, cursor: "pointer", background: view === m ? "var(--surface)" : "transparent", color: view === m ? "var(--blue)" : "var(--text3)", transition: "all 0.15s" }}>
          <Icon name={ic} size={15} color="currentColor" />
        </button>
      ))}
    </div>
  );

  const ARow = ({ a, carpetasDisp = [] }) => (
    <div className="card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 36, height: 36, background: `${tC(a.tipo)}18`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 18 }}>{fEmoji(a.tipo)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.nombre}</div>
        <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 1, display: "flex", gap: 8 }}>
          <span>{fT(a.tamaño)}</span><span>{fD(a.created_at)}</span>
          {a.es_publico && <span style={{ color: "var(--green)" }}>🌐 Público</span>}
        </div>
      </div>
      {moving?.id === a.id ? (
        <select style={{ fontSize: 12, padding: "4px 8px" }} onChange={e => moverArchivo(a, e.target.value)} defaultValue="">
          <option value="">Mover a...</option>
          <option value="null">📄 Sin carpeta</option>
          {carpetasDisp.map(c => <option key={c.id} value={c.id}>📁 {c.nombre}</option>)}
        </select>
      ) : (
        <>
          {isMain && <button className="btn-ghost" style={{ padding: 5 }} title="Mover" onClick={() => setMoving(a)}><Icon name="move" size={13} /></button>}
          {isMain && <button className="btn-ghost" style={{ padding: 5, color: a.es_publico ? "var(--green)" : "var(--text3)" }} title="Compartir" onClick={() => togglePublico(a)}><Icon name="globe" size={13} /></button>}
          <button className="btn-ghost" style={{ padding: 5 }} title="Preguntar a IA" onClick={() => onAskIA(a)}><Icon name="asistente" size={13} color="var(--blue)" /></button>
          <button className="btn-ghost" style={{ padding: 5 }} title="Abrir" onClick={() => descargar(a)}><Icon name="download" size={13} /></button>
          <button className="btn-danger" style={{ padding: "4px 6px" }} onClick={() => setConfirm({ archivo: a, nombre: a.nombre })}><Icon name="trash" size={12} /></button>
        </>
      )}
    </div>
  );

  const ACard = ({ a }) => (
    <div className="card fade-in" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ width: 44, height: 44, background: `${tC(a.tipo)}18`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{fEmoji(a.tipo)}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {isMain && <button className="btn-ghost" style={{ padding: 4, color: a.es_publico ? "var(--green)" : "var(--text3)" }} onClick={() => togglePublico(a)}><Icon name="globe" size={13} /></button>}
          <button className="btn-ghost" style={{ padding: 4 }} onClick={() => onAskIA(a)}><Icon name="asistente" size={13} color="var(--blue)" /></button>
        </div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.3 }}>{a.nombre}</div>
      <div style={{ fontSize: 10, color: "var(--text3)", display: "flex", justifyContent: "space-between" }}>
        <span>{fT(a.tamaño)}</span><span>{fD(a.created_at)}</span>
      </div>
      <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
        <button className="btn-ghost" style={{ flex: 1, justifyContent: "center", fontSize: 11, padding: "5px" }} onClick={() => descargar(a)}>Abrir</button>
        <button className="btn-danger" style={{ padding: "5px 8px" }} onClick={() => setConfirm({ archivo: a, nombre: a.nombre })}><Icon name="trash" size={12} /></button>
      </div>
    </div>
  );

  const CarpetaCard = ({ c, materiaId }) => {
    const cnt = archivos.filter(a => a.carpeta_id === c.id).length;
    return (
      <div className="card" style={{ cursor: "pointer", transition: "border-color 0.15s" }}
        onMouseEnter={e => e.currentTarget.style.borderColor = "var(--blue)"}
        onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}>
        <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }} onClick={() => setNav({ tipo: "carpeta", id: c.id, materiaId })}>
          <div style={{ fontSize: 24 }}>📁</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {renamingId === c.id ? (
              <input autoFocus style={{ width: "100%", fontSize: 13, padding: "2px 6px" }} value={renameVal}
                onChange={e => setRenameVal(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") renombrarCarpeta(c); if (e.key === "Escape") setRenamingId(null); }}
                onBlur={() => renombrarCarpeta(c)} onClick={e => e.stopPropagation()} />
            ) : (
              <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nombre}</div>
            )}
            <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 1 }}>{cnt} archivo{cnt !== 1 ? "s" : ""}{c.es_publico ? " · 🌐 Público" : ""}</div>
          </div>
          <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
            <button className="btn-ghost" style={{ padding: "4px 6px" }} title="Renombrar" onClick={() => { setRenamingId(c.id); setRenameVal(c.nombre); }}><Icon name="edit" size={12} /></button>
            {isMain && <button className="btn-ghost" style={{ padding: "4px 6px", color: c.es_publico ? "var(--green)" : "var(--text3)" }} onClick={async () => { const { error } = await ejecutar(sb.from("carpetas").update({ es_publico: !c.es_publico }).eq("id", c.id)); if (!error) onRefresh(); }}><Icon name="globe" size={12} /></button>}
            <button className="btn-danger" style={{ padding: "4px 6px" }} onClick={() => setConfirmC(c)}><Icon name="trash" size={12} /></button>
          </div>
        </div>
      </div>
    );
  };



  // VISTA CARPETA
  if (nav?.tipo === "carpeta") {
    const carpeta = carpetas.find(c => c.id === nav.id);
    const materia = materias.find(m => m.id === nav.materiaId);
    const archs = archivos.filter(a => a.carpeta_id === nav.id);
    const otherC = carpetas.filter(c => c.materia_id === nav.materiaId && c.id !== nav.id);
    return (
      <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, flexWrap: "wrap" }}>
          <button className="btn-ghost" style={{ padding: "4px 8px" }} onClick={() => setNav(null)}>Archivos</button>
          <span style={{ opacity: 0.4 }}>›</span>
          <button className="btn-ghost" style={{ padding: "4px 8px" }} onClick={() => setNav({ tipo: "materia", id: nav.materiaId })}>{materia?.nombre}</button>
          <span style={{ opacity: 0.4 }}>›</span>
          <span style={{ fontWeight: 700 }}>📁 {carpeta?.nombre}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "var(--text2)" }}>{archs.length} archivo{archs.length !== 1 ? "s" : ""}</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}><VT /><SubirBtn materiaId={nav.materiaId} carpetaId={nav.id} /></div>
        </div>
        <DropZone materiaId={nav.materiaId} carpetaId={nav.id} />
        {view === "grid"
          ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 10 }}>{archs.length === 0 ? <div style={{ gridColumn: "1/-1", textAlign: "center", color: "var(--text2)", padding: 24 }}>Carpeta vacía</div> : archs.map(a => <ACard key={a.id} a={a} />)}</div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{archs.length === 0 ? <div style={{ textAlign: "center", color: "var(--text2)", padding: 24, fontSize: 13 }}>Carpeta vacía — arrastrá archivos o usá el botón</div> : archs.map(a => <ARow key={a.id} a={a} carpetasDisp={otherC} />)}</div>
        }
        {confirm && <ConfirmModal nombre={confirm.nombre} onClose={() => setConfirm(null)} onConfirm={() => { eliminar(confirm.archivo); setConfirm(null); }} />}
        <UpPanel />
      </div>
    );
  }

  // VISTA MATERIA
  if (nav?.tipo === "materia") {
    const materia = materias.find(m => m.id === nav.id);
    const est = ESTADOS[materia?.estado];
    const carpetasM = carpetas.filter(c => c.materia_id === nav.id);
    const archsD = archivos.filter(a => a.materia_id === nav.id && !a.carpeta_id);
    return (
      <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, flexWrap: "wrap" }}>
          <button className="btn-ghost" style={{ padding: "4px 8px" }} onClick={() => setNav(null)}>Archivos</button>
          <span style={{ opacity: 0.4 }}>›</span>
          <span style={{ fontWeight: 700 }}>{materia?.nombre}</span>
          {est && <span className="tag" style={{ background: est.bg, color: est.color }}>{est.label}</span>}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setNewFolder(true)}><Icon name="plus" size={12} /> Nueva carpeta</button>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}><VT /><SubirBtn materiaId={nav.id} /></div>
        </div>
        {carpetasM.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 8 }}>
            {carpetasM.map(c => <CarpetaCard key={c.id} c={c} materiaId={nav.id} />)}
          </div>
        )}
        <DropZone materiaId={nav.id} />
        {archsD.length > 0 && <p className="section-title" style={{ marginTop: 4 }}>Archivos sueltos</p>}
        {view === "grid"
          ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 10 }}>{archsD.map(a => <ACard key={a.id} a={a} />)}</div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{archsD.length === 0 ? <div style={{ textAlign: "center", color: "var(--text3)", fontSize: 12, padding: 10 }}>Sin archivos sueltos. Subí aquí o en una carpeta.</div> : archsD.map(a => <ARow key={a.id} a={a} carpetasDisp={carpetasM} />)}</div>
        }
        {newFolder && (
          <Modal title="Nueva Carpeta" onClose={() => { setNewFolder(false); setFolderName(""); }}>
            <input style={{ width: "100%" }} value={folderName} onChange={e => setFolderName(e.target.value)} onKeyDown={e => e.key === "Enter" && crearCarpeta()} placeholder="Nombre de la carpeta..." />
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={crearCarpeta}>Crear</button>
              <button className="btn-ghost" onClick={() => { setNewFolder(false); setFolderName(""); }}>Cancelar</button>
            </div>
          </Modal>
        )}
        {confirm && <ConfirmModal nombre={confirm.nombre} onClose={() => setConfirm(null)} onConfirm={() => { eliminar(confirm.archivo); setConfirm(null); }} />}
        {confirmC && <ConfirmModal nombre={`carpeta "${confirmC.nombre}"`} onClose={() => setConfirmC(null)} onConfirm={() => { eliminarCarpeta(confirmC); setConfirmC(null); }} />}
        <UpPanel />
      </div>
    );
  }

  // VISTA RAÍZ
  const matsC = materias.filter(m => archivos.some(a => a.materia_id === m.id) || carpetas.some(c => c.materia_id === m.id));
  const matsV = materias.filter(m => !archivos.some(a => a.materia_id === m.id) && !carpetas.some(c => c.materia_id === m.id));
  const resBusq = archivos.filter(a => a.nombre.toLowerCase().includes(busq.toLowerCase()));
  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="card" style={{ padding: "16px 20px", background: "linear-gradient(135deg,var(--surface),var(--surface2))", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 44, height: 44, background: "var(--blue-dim)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon name="archivos" size={22} color="var(--blue)" />
        </div>
        <div>
          <h2 style={{ fontFamily: "'Barlow Condensed'", fontSize: 22, fontWeight: 800, lineHeight: 1 }}>BIBLIOTECA</h2>
          <p style={{ fontSize: 11, color: "var(--text3)", marginTop: 3 }}>{archivos.length} archivos · {carpetas.length} carpetas · Seleccioná una materia para subir</p>
        </div>
      </div>
      <div style={{ position: "relative" }}>
        <input style={{ width: "100%", paddingLeft: 36, fontSize: 13 }} placeholder="Buscar archivos en todas las materias..." value={busq} onChange={e => setBusq(e.target.value)} />
        <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", opacity: 0.4 }}><Icon name="dashboard" size={15} /></div>
        {busq && <button style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: 18 }} onClick={() => setBusq("")}>×</button>}
      </div>
      {busq ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <p className="section-title">{resBusq.length} resultado{resBusq.length !== 1 ? "s" : ""} para "{busq}"</p>
          {resBusq.length === 0
            ? <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--text2)" }}>Sin resultados</div>
            : resBusq.map(a => {
              const mat = materias.find(m => m.id === a.materia_id);
              return (
                <div key={a.id} className="card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => { setBusq(""); setNav({ tipo: "materia", id: a.materia_id }); }}>
                  <div style={{ fontSize: 20 }}>{fEmoji(a.tipo)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.nombre}</div>
                    <div style={{ fontSize: 10, color: "var(--text3)" }}>{mat?.nombre} · {fT(a.tamaño)}</div>
                  </div>
                  <Icon name="chevronR" size={14} color="var(--text3)" />
                </div>
              );
            })
          }
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {matsC.length > 0 && <>
            <p className="section-title">Materias con archivos</p>
            {matsC.map(m => {
              const est = ESTADOS[m.estado];
              const tA = archivos.filter(a => a.materia_id === m.id).length;
              const tC2 = carpetas.filter(c => c.materia_id === m.id).length;
              return (
                <div key={m.id} className="card" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", transition: "border-color 0.15s" }}
                  onClick={() => setNav({ tipo: "materia", id: m.id })}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "var(--blue)"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}>
                  <div style={{ width: 3, alignSelf: "stretch", borderRadius: 2, background: est?.color, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{m.nombre}</div>
                    <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 2 }}>{tA} archivo{tA !== 1 ? "s" : ""} · {tC2} carpeta{tC2 !== 1 ? "s" : ""}</div>
                  </div>
                  <span className="tag" style={{ background: est?.bg, color: est?.color }}>{est?.label}</span>
                  <Icon name="chevronR" size={16} color="var(--text3)" />
                </div>
              );
            })}
          </>}
          {matsV.length > 0 && <>
            <p className="section-title" style={{ marginTop: 4 }}>Sin archivos aún</p>
            {matsV.map(m => (
              <div key={m.id} className="card" style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", opacity: 0.5, transition: "opacity 0.15s" }}
                onClick={() => setNav({ tipo: "materia", id: m.id })}
                onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                onMouseLeave={e => e.currentTarget.style.opacity = "0.5"}>
                <span style={{ flex: 1, fontSize: 13 }}>{m.nombre}</span>
                <Icon name="chevronR" size={14} color="var(--text3)" />
              </div>
            ))}
          </>}
          {materias.length === 0 && <div className="card" style={{ padding: 28, textAlign: "center", color: "var(--text2)" }}>Agregá materias primero para organizar tus archivos</div>}
        </div>
      )}
      <UpPanel />
    </div>
  );
}


function VistaChatArchivo({ archivo, onClose, callIA, modelo }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [reading, setReading] = useState(true);
  const [contexto, setContexto] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => { extraerTexto(); }, [archivo]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, loading]);

  const extraerTexto = async () => {
    setReading(true);
    try {
      const res = await fetch(`/api/upload?key=${encodeURIComponent(archivo.storage_path)}`);
      const { url } = await res.json();
      const fileRes = await fetch(url);
      const blob = await fileRes.blob();

      if (archivo.tipo === "PDF") {
        const arrayBuffer = await blob.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = "";
        for (let i = 1; i <= Math.min(pdf.numPages, 15); i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          fullText += content.items.map(s => s.str).join(" ") + " ";
        }
        setContexto(fullText);
      } else {
        const text = await blob.text();
        setContexto(text);
      }
      setMsgs([{ role: "assistant", content: `Analicé "${archivo.nombre}". ¿Qué duda tenés?` }]);
    } catch (e) {
      setMsgs([{ role: "assistant", content: "No pude leer el archivo, pero preguntame igual y trato de ayudarte." }]);
    }
    setReading(false);
  };

  const enviar = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input.trim() };
    const nMsgs = [...msgs, userMsg];
    setMsgs(nMsgs); setInput(""); setLoading(true);
    try {
      const sys = `Sos un experto analizando el apunte "${archivo.nombre}". Contexto: ${contexto.slice(0, 10000)}. Respondé de forma académica y clara.`;
      const txt = await callIA(sys, nMsgs, modelo);
      setMsgs(m => [...m, { role: "assistant", content: txt }]);
    } catch (e) { setMsgs(m => [...m, { role: "assistant", content: "Error: " + e.message }]); }
    setLoading(false);
  };

  return (
    <Modal title={`IA: ${archivo.nombre}`} onClose={onClose} width="500px">
      <div style={{ height: 400, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
          {reading && <div style={{ textAlign: "center", padding: 20 }}><Spinner /><p style={{ fontSize: 12, marginTop: 10 }}>Leyendo apunte...</p></div>}
          {msgs.map((m, i) => (
            <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", background: m.role === "user" ? "var(--blue)" : "var(--surface2)", color: m.role === "user" ? "#fff" : "var(--text)", padding: "8px 12px", borderRadius: 10, fontSize: 13, maxWidth: "85%" }}>
              {m.content}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div style={{ display: "flex", gap: 8, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
          <input style={{ flex: 1 }} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && enviar()} placeholder="Escribí una pregunta..." disabled={reading} />
          <button className="btn-primary" onClick={enviar} disabled={loading || reading}><Icon name="send" size={16} color="#fff" /></button>
        </div>
      </div>
    </Modal>
  );
}

// ─── ASISTENTE IA ─────────────────────────────────────────────────────────────
function VistaAsistente({ materias, eventos }) {
  const [historial, setHistorial] = useState(() => {
    try { return JSON.parse(localStorage.getItem("utn_historial") || "{}"); } catch { return {}; }
  });
  const [modelo, setModelo] = useState(() => localStorage.getItem("utn_modelo") || "claude");
  const [materiaId, setMateriaId] = useState(materias.find(m => ["cursando", "regular"].includes(m.estado))?.id || materias[0]?.id || null);
  const [modo, setModo] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const materia = materias.find(m => m.id === materiaId);

  const cambiarModelo = (m) => { setModelo(m); localStorage.setItem("utn_modelo", m); };

  useEffect(() => {
    if (materiaId && modo) { const k = `${materiaId}_${modo}`; setMsgs(historial[k] || []); }
  }, [materiaId, modo]);

  useEffect(() => {
    if (materiaId && modo && msgs.length > 0) {
      const k = `${materiaId}_${modo}`;
      const nuevo = { ...historial, [k]: msgs.slice(-20) };
      setHistorial(nuevo);
      localStorage.setItem("utn_historial", JSON.stringify(nuevo));
    }
  }, [msgs]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, loading]);

  const mkSystem = (m) => {
    const ev = eventos.filter(e => e.materia_id === materiaId).map(e => `${e.tipo}: ${e.titulo} el ${e.fecha}`).join(", ") || "ninguno";
    const base = `Sos un asistente de estudio universitario para la materia "${materia?.nombre}" de UTN Sistemas Argentina. Año ${materia?.año}, cuatrimestre ${materia?.cuatrimestre}. Estado: ${ESTADOS[materia?.estado]?.label}. Eventos: ${ev}. Respondé siempre en español argentino, claro y directo.`;
    return {
      tutor: `${base} Modo TUTOR: evaluá si el alumno entendió los temas. Hacé preguntas concretas de a una, esperá respuesta, evaluá. No des la respuesta antes. Empezá preguntando qué tema quiere repasar.`,
      planificar: `${base} Modo PLANIFICADOR: ayudá a organizar un plan de estudio. Preguntá cuántos días y horas disponibles tiene. Luego armá un plan día por día.`,
      tp: `${base} Modo TP: ayudá con trabajos prácticos guiando sin dar la solución directa. Empezá preguntando en qué consiste el TP.`,
      libre: `${base} Modo LIBRE: respondé cualquier consulta académica. Saludo breve y preguntá en qué ayudar.`,
    }[m] || base;
  };

  const callIA = async (systemPrompt, messages) => {
    const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ system: systemPrompt, messages, modelo }) });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.text;
  };

  const iniciarModo = async (m) => {
    setModo(m);
    const k = `${materiaId}_${m}`;
    if (historial[k]?.length > 0) { setMsgs(historial[k]); return; }
    setMsgs([]); setLoading(true);
    try {
      const txt = await callIA(mkSystem(m), [{ role: "user", content: "Hola, empecemos." }]);
      setMsgs([{ role: "assistant", content: txt }]);
    } catch (e) { setMsgs([{ role: "assistant", content: "Hola, estoy listo. ¿En qué te puedo ayudar?" }]); }
    setLoading(false);
  };

  const enviar = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input.trim() };
    const newMsgs = [...msgs, userMsg];
    setMsgs(newMsgs); setInput(""); setLoading(true);
    try {
      const txt = await callIA(mkSystem(modo), newMsgs.map(m => ({ role: m.role, content: m.content })));
      setMsgs(m => [...m, { role: "assistant", content: txt }]);
    } catch (e) { setMsgs(m => [...m, { role: "assistant", content: `Error: ${e.message}` }]); }
    setLoading(false);
  };

  const limpiar = () => {
    setMsgs([]);
    if (materiaId && modo) {
      const k = `${materiaId}_${modo}`;
      const nuevo = { ...historial }; delete nuevo[k];
      setHistorial(nuevo);
      localStorage.setItem("utn_historial", JSON.stringify(nuevo));
    }
  };

  const modeloInfo = MODELOS_IA.find(m => m.id === modelo);

  if (!modo) return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <Lbl>Seleccioná una materia</Lbl>
        <select style={{ width: "100%", maxWidth: 420 }} value={materiaId || ""} onChange={e => setMateriaId(e.target.value)}>
          {materias.map(m => <option key={m.id} value={m.id}>{m.nombre} ({ESTADOS[m.estado]?.label})</option>)}
        </select>
      </div>

      {materia && <div className="card" style={{ padding: "14px 16px", borderLeft: "3px solid var(--blue)" }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{materia.nombre}</div>
        <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 2 }}>Año {materia.año} · {materia.cuatrimestre}° cuat. · <span style={{ color: ESTADOS[materia.estado]?.color }}>{ESTADOS[materia.estado]?.label}</span></div>
      </div>}

      <div>
        <p className="section-title">Motor de IA</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {MODELOS_IA.map(m => (
            <button key={m.id} onClick={() => cambiarModelo(m.id)} style={{
              padding: "8px 16px", borderRadius: 6, fontSize: 13, fontWeight: 600,
              border: `1px solid ${modelo === m.id ? m.color : "var(--border)"}`,
              background: modelo === m.id ? `${m.color}18` : "transparent",
              color: modelo === m.id ? m.color : "var(--text2)",
              transition: "all 0.15s"
            }}>{m.label}</button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 8 }}>
          Motor seleccionado: <span style={{ color: modeloInfo?.color, fontWeight: 600 }}>{modeloInfo?.label}</span>
        </div>
      </div>

      <div>
        <p className="section-title">Elegí un modo</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 10 }}>
          {MODOS_IA.map(mo => {
            const tiene = historial[`${materiaId}_${mo.id}`]?.length > 0;
            return (
              <button key={mo.id} onClick={() => iniciarModo(mo.id)} style={{ background: "var(--surface)", border: `1px solid ${tiene ? "var(--blue)" : "var(--border)"}`, borderRadius: 10, padding: "16px", textAlign: "left", transition: "all 0.15s", cursor: "pointer" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--blue)"; e.currentTarget.style.background = "var(--blue-dim)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = tiene ? "var(--blue)" : "var(--border)"; e.currentTarget.style.background = "var(--surface)"; }}>
                <div style={{ fontFamily: "'Barlow Condensed'", fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 5 }}>{mo.label}</div>
                <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5 }}>{mo.desc}</div>
                {tiene && <div style={{ fontSize: 10, color: "var(--blue)", marginTop: 8, fontWeight: 500 }}>Sesión guardada · Continuar</div>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  const modoInfo = MODOS_IA.find(m => m.id === modo);
  const totalMsgs = msgs.length;

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 130px)", minHeight: 400 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <button className="btn-ghost" style={{ padding: "6px 11px", fontSize: 12 }} onClick={() => setModo(null)}><Icon name="chevronL" size={13} />Volver</button>
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{materia?.nombre}</span>
          <span className="tag" style={{ background: "var(--blue-dim)", color: "var(--blue)" }}>{modoInfo?.label}</span>
          <span className="tag" style={{ background: `${modeloInfo?.color}18`, color: modeloInfo?.color, fontSize: 10 }}>{modeloInfo?.label}</span>
        </div>
        <button className="btn-ghost" style={{ padding: "6px 10px" }} onClick={limpiar} title="Limpiar conversación"><Icon name="refresh" size={13} /></button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingRight: 4 }}>
        {msgs.length === 0 && !loading && <div style={{ textAlign: "center", color: "var(--text2)", fontSize: 13, padding: "40px 20px" }}>Iniciando sesión...</div>}
        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{ maxWidth: "80%", padding: "10px 14px", borderRadius: 10, fontSize: 13, lineHeight: 1.6, background: m.role === "user" ? "var(--blue)" : "var(--surface2)", color: m.role === "user" ? "#fff" : "var(--text)", borderBottomRightRadius: m.role === "user" ? 2 : 10, borderBottomLeftRadius: m.role === "assistant" ? 2 : 10, border: m.role === "assistant" ? "1px solid var(--border)" : "none", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.content}</div>
          </div>
        ))}
        {loading && <div style={{ display: "flex", justifyContent: "flex-start" }}><div style={{ padding: "10px 16px", borderRadius: 10, background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", gap: 5, alignItems: "center" }}>{[0, 1, 2].map(i => <span key={i} className="pulse" style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--blue)", display: "inline-block", animationDelay: `${i * 0.2}s` }} />)}</div></div>}
        <div ref={bottomRef} />
      </div>

      <div style={{ textAlign: "center", fontSize: 11, color: "var(--text3)", padding: "6px 0 4px" }}>
        {totalMsgs} {totalMsgs === 1 ? "mensaje" : "mensajes"} en esta sesión
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }} placeholder="Escribí tu mensaje... (Enter para enviar)" rows={2} style={{ flex: 1, resize: "none", borderRadius: 8, lineHeight: 1.5, fontSize: 13, padding: "10px 12px" }} />
        <button className="btn-primary" onClick={enviar} disabled={loading || !input.trim()} style={{ padding: "10px 14px", opacity: loading || !input.trim() ? 0.5 : 1 }}><Icon name="send" size={15} color="#fff" /></button>
      </div>
    </div>
  );
}

// ─── NAV ──────────────────────────────────────────────────────────────────────

// ─── TUTORIAL DE ONBOARDING ───────────────────────────────────────────────────
function TutorialModal({ onClose }) {
  const [step, setStep] = useState(0);
  const steps = [
    {
      title: "¡Bienvenido a UTN Tracker! 🎓",
      desc: "Tu nueva libreta universitaria digital. Llevá el control de tus materias, organizá tus apuntes y tené siempre a mano tu horario de cursado.",
      icon: "🎓"
    },
    {
      title: "1. Carga tus Materias",
      desc: "Ve a la pestaña 'Materias' y usa la vista de 'Mapa' para importar automáticamente todo tu plan de estudios con un solo clic.",
      icon: "📋"
    },
    {
      title: "2. Arma tu Horario",
      desc: "Edita los días y horas de cursado de tus materias para generar automáticamente tu grilla de horarios semanal (como en un calendario).",
      icon: "📅"
    },
    {
      title: "3. Tu Biblioteca en la Nube",
      desc: "En 'Archivos' puedes subir tus resúmenes y organizarlos en carpetas. Podés hacerlos públicos para compartirlos con tus compañeros de facultad.",
      icon: "☁️"
    }
  ];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="card fade-in" style={{ width: "100%", maxWidth: 420, padding: 32, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>{steps[step].icon}</div>
        <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: "'Barlow Condensed'", marginBottom: 12 }}>{steps[step].title}</h2>
        <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.5, minHeight: 65 }}>{steps[step].desc}</p>
        
        <div style={{ display: "flex", gap: 6, margin: "24px 0" }}>
          {steps.map((_, i) => (
            <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: i === step ? "var(--blue)" : "var(--border)", transition: "all 0.3s" }} />
          ))}
        </div>

        <div style={{ display: "flex", gap: 12, width: "100%" }}>
          {step > 0 && <button className="btn-ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => setStep(s => s - 1)}>Atrás</button>}
          {step < steps.length - 1 ? (
            <button className="btn-primary" style={{ flex: 2, justifyContent: "center" }} onClick={() => setStep(s => s + 1)}>Siguiente</button>
          ) : (
            <button className="btn-primary" style={{ flex: 2, justifyContent: "center", background: "var(--green)", color: "#000", border: "none" }} onClick={onClose}>¡Empezar a usar!</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [showTutorial, setShowTutorial] = useState(() => !localStorage.getItem("utn_tutorial"));
  const isMobile = useIsMobile();
  const [session, setSession] = useState(undefined);
  const [vista, setVista] = useState("dashboard");
  const [sideOpen, setSideOpen] = useState(!isMobile);
  const [materias, setMaterias] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [archivos, setArchivos] = useState([]);
  const [carpetas, setCarpetas] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [online, setOnline] = useState(() => navigator.onLine);

  const [enfoque, setEnfoque] = useState(() => {
    const saved = localStorage.getItem("utn_enfoque");
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...parsed, activo: false };
    }
    return { mins: 25, secs: 0, activo: false, modo: "estudio", matId: "", target: null };
  });

  const [chatArchivo, setChatArchivo] = useState(null);

  useEffect(() => {
    localStorage.setItem("utn_enfoque", JSON.stringify(enfoque));
  }, [enfoque]);

  useEffect(() => {
    let interval;
    if (enfoque.activo && enfoque.target) {
      interval = setInterval(() => {
        const now = Date.now();
        const diff = Math.max(0, Math.floor((enfoque.target - now) / 1000));
        if (diff === 0) {
          clearInterval(interval);
          finalizarCicloEnfoque();
        } else {
          setEnfoque(prev => ({ ...prev, mins: Math.floor(diff / 60), secs: diff % 60 }));
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [enfoque.activo, enfoque.target]);

  const finalizarCicloEnfoque = () => {
    const audio = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
    audio.play().catch(() => { });
    if (Notification.permission === "granted") {
      new Notification(enfoque.modo === "estudio" ? "¡Bloque terminado!" : "¡Descanso terminado!", { body: enfoque.modo === "estudio" ? "Es hora de un descanso." : "Volvemos al estudio." });
    }
    const proxModo = enfoque.modo === "estudio" ? "descanso" : "estudio";
    const proxMins = proxModo === "estudio" ? 25 : 5;
    setEnfoque(prev => ({ ...prev, activo: false, modo: proxModo, mins: proxMins, secs: 0, target: null }));
  };

  const startEnfoque = (m, mid) => {
    const mins = m || enfoque.mins;
    const target = Date.now() + (mins * 60 + enfoque.secs) * 1000;
    setEnfoque(prev => ({ ...prev, activo: true, target, matId: mid || prev.matId }));
  };
  const pauseEnfoque = () => setEnfoque(prev => ({ ...prev, activo: false, target: null }));
  const resetEnfoque = () => setEnfoque(prev => ({ ...prev, activo: false, target: null, mins: prev.modo === "estudio" ? 25 : 5, secs: 0 }));
  const setModoEnfoque = (m) => setEnfoque(prev => ({ ...prev, modo: m, mins: m === "estudio" ? 25 : 5, secs: 0, activo: false, target: null }));

  const progEnfoque = enfoque.modo === "estudio" ? ((25 - enfoque.mins) * 60 + (60 - enfoque.secs)) / (25 * 60) * 100 : ((5 - enfoque.mins) * 60 + (60 - enfoque.secs)) / (5 * 60) * 100;
  const { toasts, show: showToast } = useToast();
  const [showNotifs, setShowNotifs] = useState(false);
  const [showPushConfig, setShowPushConfig] = useState(false);
  const [iaActiva, setIaActiva] = useState(false);

  const userId = session?.user?.id;
  const { estado: pushEstado, activar: activarPush, desactivar: desactivarPush } = usePushNotifications(userId);

  useEffect(() => { setSideOpen(!isMobile); }, [isMobile]);

  useEffect(() => {
    sb.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = sb.auth.onAuthStateChange((_, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) cargarTodo();
    else { setMaterias([]); setEventos([]); setTareas([]); setArchivos([]); setCarpetas([]); setLoadingData(false); }
  }, [session]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const cargarTodo = async () => {
    const uid = session.user.id;
    // 1) Hidratar al instante desde la caché local (también funciona sin internet)
    const cached = loadCache(uid);
    if (cached) {
      setMaterias(cached.materias || []);
      setEventos(cached.eventos || []);
      setTareas(cached.tareas || []);
      setArchivos(cached.archivos || []);
      setCarpetas(cached.carpetas || []);
      setLoadingData(false);
    } else {
      setLoadingData(true);
    }
    // 2) Refrescar desde Supabase; si no hay red, nos quedamos con lo cacheado
    try {
      const [{ data: m }, { data: e }, { data: t }, { data: a }, { data: c }] = await Promise.all([
        sb.from("materias").select("*").order("año"),
        sb.from("eventos").select("*").order("fecha"),
        sb.from("tareas").select("*").order("vencimiento"),
        sb.from("archivos").select("*").order("created_at", { ascending: false }),
        sb.from("carpetas").select("*").order("nombre"),
      ]);
      const fresh = { materias: m || [], eventos: e || [], tareas: t || [], archivos: a || [], carpetas: c || [] };
      setMaterias(fresh.materias);
      setEventos(fresh.eventos);
      setTareas(fresh.tareas);
      setArchivos(fresh.archivos);
      setCarpetas(fresh.carpetas);
      saveCache(uid, fresh);
    } catch {
      if (!cached) showToast("Sin conexión y todavía no hay datos guardados.");
    } finally {
      setLoadingData(false);
    }
  };

  const addMateria = async (f) => {
    const payload = { ...f, user_id: session.user.id };
    if (payload.nota === "") payload.nota = null;
    const { data, error } = await ejecutar(sb.from("materias").insert(payload).select().single());
    if (error) { showToast(error); return; }
    setMaterias(m => [...m, data]);
  };
  const editMateria = async (id, f) => {
    const payload = { ...f };
    if (payload.nota === "") payload.nota = null;
    const { data, error } = await ejecutar(sb.from("materias").update(payload).eq("id", id).select().single());
    if (error) { showToast(error); return; }
    setMaterias(m => m.map(x => x.id === id ? data : x));
  };
  const delMateria = async (id) => {
    const { error } = await ejecutar(sb.from("materias").delete().eq("id", id));
    if (error) { showToast(error); return; }
    setMaterias(m => m.filter(x => x.id !== id));
  };
  const addEvento = async (f) => {
    const { data, error } = await ejecutar(sb.from("eventos").insert({ ...f, user_id: session.user.id }).select().single());
    if (error) { showToast(error); return; }
    setEventos(e => [...e, data]);
  };
  const editEvento = async (id, f) => {
    const { data, error } = await ejecutar(sb.from("eventos").update(f).eq("id", id).select().single());
    if (error) { showToast(error); return; }
    setEventos(e => e.map(x => x.id === id ? data : x));
  };
  const delEvento = async (id) => {
    const { error } = await ejecutar(sb.from("eventos").delete().eq("id", id));
    if (error) { showToast(error); return; }
    setEventos(e => e.filter(x => x.id !== id));
  };

  const onAddTarea = async (f) => {
    const { data, error } = await ejecutar(sb.from("tareas").insert({ ...f, user_id: session.user.id }).select().single());
    if (error) { showToast(error); return; }
    setTareas(t => [...t, data]);
  };

  const onToggleTarea = async (id, completada) => {
    const { data, error } = await ejecutar(sb.from("tareas").update({ completada }).eq("id", id).select().single());
    if (error) { showToast(error); return; }
    setTareas(t => t.map(x => x.id === id ? data : x));
  };

  const onDeleteTarea = async (id) => {
    const { error } = await ejecutar(sb.from("tareas").delete().eq("id", id));
    if (error) { showToast(error); return; }
    setTareas(t => t.filter(x => x.id !== id));
  };

  if (session === undefined) return <div style={{ minHeight: "100vh", background: "#0b0e13", display: "flex", alignItems: "center", justifyContent: "center" }}><style>{G}</style><Spinner /></div>;
  if (!session) return <AuthPage onAuth={() => sb.auth.getSession().then(({ data: { session } }) => setSession(session))} />;

  return (
    <>
      <style>{G}</style>
      {!online && (
        <div style={{ background: "#f59e0b", color: "#0b0e13", textAlign: "center", fontSize: 12, fontWeight: 600, padding: "5px 12px", position: "sticky", top: 0, zIndex: 100 }}>
          Sin conexión — viendo tus datos guardados
        </div>
      )}
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <aside className="sidebar" style={{ width: sideOpen ? 216 : 56, flexShrink: 0, background: "var(--surface)", borderRight: "1px solid var(--border)", flexDirection: "column", transition: "width 0.22s ease", overflow: "hidden", position: "sticky", top: 0, height: "100vh" }}>
          <div style={{ padding: "17px 13px", display: "flex", alignItems: "center", gap: 9, borderBottom: "1px solid var(--border)", minHeight: 60 }}>
            <div style={{ width: 28, height: 28, background: "var(--blue)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Barlow Condensed'", fontWeight: 800, color: "#fff", fontSize: 14, flexShrink: 0 }}>U</div>
            {sideOpen && <div><div style={{ fontFamily: "'Barlow Condensed'", fontWeight: 800, fontSize: 15, letterSpacing: 0.5, lineHeight: 1 }}>UTN TRACKER</div><div style={{ fontSize: 9, color: "var(--text3)", letterSpacing: 1.5, marginTop: 2 }}>SISTEMAS · TUC</div></div>}
          </div>
          <nav style={{ padding: "9px 6px", flex: 1 }}>
            {NAV.map(n => {
              const ac = vista === n.id; return (
                <button key={n.id} onClick={() => setVista(n.id)} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "9px 10px", borderRadius: 6, border: "none", marginBottom: 1, background: ac ? "var(--blue-dim)" : "transparent", color: ac ? "var(--blue)" : "var(--text2)", fontSize: 13, fontWeight: ac ? 600 : 400, transition: "all 0.12s", textAlign: "left" }}
                  onMouseEnter={e => { if (!ac) { e.currentTarget.style.background = "var(--surface2)"; e.currentTarget.style.color = "var(--text)"; } }}
                  onMouseLeave={e => { if (!ac) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text2)"; } }} >
                  <span style={{ flexShrink: 0, opacity: ac ? 1 : 0.7 }}><Icon name={n.icon} size={16} color={ac ? "var(--blue)" : "currentColor"} /></span>
                  {sideOpen && <span>{n.label}</span>}
                  {sideOpen && ac && <span style={{ marginLeft: "auto", width: 3, height: 3, borderRadius: "50%", background: "var(--blue)" }} />}
                </button>
              );
            })}
          </nav>
          {sideOpen && session && <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, color: "var(--text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 6 }}>{session.user.email}</div>
            <button className="btn-ghost" style={{ width: "100%", justifyContent: "center", fontSize: 12, padding: "6px" }} onClick={() => sb.auth.signOut()}><Icon name="logout" size={13} />Cerrar sesión</button>
          </div>}
          <button onClick={() => setSideOpen(o => !o)} style={{ margin: "9px 6px", padding: "9px", border: "1px solid var(--border)", borderRadius: 6, background: "transparent", color: "var(--text2)", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--blue)"; e.currentTarget.style.color = "var(--blue)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text2)"; }}>
            <Icon name={sideOpen ? "chevronL" : "chevronR"} size={14} />
          </button>
        </aside>

        <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <header className="header-pad" style={{ borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, background: "var(--surface)", position: "sticky", top: 0, zIndex: 10 }}>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontFamily: "'Barlow Condensed'", fontSize: 20, fontWeight: 800, letterSpacing: 0.3 }}>{TITULOS[vista]}</h1>
            </div>
            {pushEstado !== "no-soportado" && (
              <button onClick={() => setShowPushConfig(true)}
                style={{
                  background: pushEstado === "activo" ? "var(--blue-dim)" : "var(--surface2)",
                  border: `1px solid ${pushEstado === "activo" ? "var(--blue)" : pushEstado === "denegado" ? "var(--border)" : "var(--border)"}`,
                  borderRadius: 7, padding: "7px 9px", display: "flex", alignItems: "center",
                  cursor: pushEstado === "denegado" ? "not-allowed" : "pointer",
                  color: pushEstado === "activo" ? "var(--blue)" : pushEstado === "denegado" ? "var(--text3)" : "var(--text2)",
                  transition: "all 0.15s", opacity: pushEstado === "solicitando" ? 0.6 : 1
                }}
                onMouseEnter={e => { if (pushEstado !== "denegado" && pushEstado !== "activo") { e.currentTarget.style.borderColor = "var(--blue)"; e.currentTarget.style.color = "var(--blue)"; } }}
                onMouseLeave={e => { if (pushEstado !== "denegado" && pushEstado !== "activo") { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text2)"; } }}
                disabled={pushEstado === "solicitando" || pushEstado === "denegado"}>
                <Icon name="bell" size={16} color="currentColor" />
              </button>
            )}
            {/* Botón panel notificaciones */}
            <button onClick={() => setShowNotifs(true)} style={{
              background: "var(--surface2)", border: "1px solid var(--border)",
              borderRadius: 7, padding: "7px 9px", display: "flex", alignItems: "center", cursor: "pointer",
              transition: "border-color 0.15s", color: "var(--text2)"
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--blue)"; e.currentTarget.style.color = "var(--blue)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text2)"; }}>
              <Icon name="dashboard" size={16} color="currentColor" />
            </button>
          </header>
          <div className="main-pad" style={{ flex: 1 }}>
            {loadingData ? <Spinner /> : <>
              {vista === "dashboard" && <Dashboard materias={materias} eventos={eventos} />}
              {vista === "materias" && <VistasMaterias materias={materias} onAdd={addMateria} onEdit={editMateria} onDelete={delMateria} />}
              {vista === "horarios" && <VistaHorarios materias={materias} />}
              {vista === "eventos" && <VistaEventos materias={materias} eventos={eventos} tareas={tareas} onAdd={addEvento} onEdit={editEvento} onDelete={delEvento} onAddTarea={onAddTarea} onToggleTarea={onToggleTarea} onDeleteTarea={onDeleteTarea} />}
              {vista === "enfoque" && <VistaEnfoque materias={materias} sessionEnfoque={{ ...enfoque, progreso: progEnfoque }} onStart={startEnfoque} onPause={pauseEnfoque} onReset={resetEnfoque} onSetModo={setModoEnfoque} />}
              {vista === "archivos" && <VistaArchivos materias={materias} archivos={archivos} carpetas={carpetas} userId={session.user.id} showToast={showToast} onAskIA={(a) => setChatArchivo(a)} onRefresh={cargarTodo} />}
              {vista === "asistente" && (iaActiva ? <VistaAsistente materias={materias} eventos={eventos} /> : <BloqueadoIA />)}
            </>}
          </div>
        </main>
      </div>

      {/* BOTTOM NAV mobile */}
      <nav className="bottom-nav" style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: "var(--nav-h)", background: "var(--surface)", borderTop: "1px solid var(--border)", alignItems: "center", justifyContent: "space-around", zIndex: 50, paddingBottom: "env(safe-area-inset-bottom)" }}>
        {NAV.map(n => {
          const ac = vista === n.id; return (
            <button key={n.id} onClick={() => setVista(n.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", color: ac ? "var(--blue)" : "var(--text3)", padding: "6px 8px", borderRadius: 8, transition: "color 0.15s", minWidth: 44 }}>
              <Icon name={n.icon} size={20} color={ac ? "var(--blue)" : "currentColor"} />
              <span style={{ fontSize: 9, fontWeight: ac ? 700 : 400, letterSpacing: 0.3 }}>{n.label}</span>
            </button>
          );
        })}
      </nav>

      {/* MODAL TUTORIAL */}
      {showTutorial && <TutorialModal onClose={() => { localStorage.setItem("utn_tutorial", "true"); setShowTutorial(false); }} />}

      {/* TOASTS */}
      <ToastContainer toasts={toasts} />
      {/* PANEL NOTIFICACIONES INTERNAS */}
      {showNotifs && <PanelNotificaciones materias={materias} eventos={eventos} onClose={() => setShowNotifs(false)} />}
      {/* MODAL CONFIGURACIÓN PUSH */}
      {showPushConfig && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={e => e.target === e.currentTarget && setShowPushConfig(false)}>
          <div className="card fade-in" style={{ width: "100%", maxWidth: 380, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <span style={{ fontFamily: "'Barlow Condensed'", fontSize: 17, fontWeight: 700 }}>Notificaciones push</span>
              <button onClick={() => setShowPushConfig(false)} style={{ background: "none", border: "none", color: "var(--text2)", fontSize: 20, cursor: "pointer" }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {pushEstado === "no-soportado" && (
                <p style={{ fontSize: 13, color: "var(--text2)" }}>Tu navegador no soporta notificaciones push.</p>
              )}
              {pushEstado === "denegado" && (
                <div>
                  <p style={{ fontSize: 13, color: "var(--red)", marginBottom: 8 }}>Notificaciones bloqueadas en el navegador.</p>
                  <p style={{ fontSize: 12, color: "var(--text2)" }}>Para activarlas, entrá a la configuración del navegador y permitilas para este sitio.</p>
                </div>
              )}
              {(pushEstado === "idle" || pushEstado === "solicitando") && (
                <div>
                  <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 16, lineHeight: 1.6 }}>
                    Activá las notificaciones push para recibir recordatorios de clases, parciales y eventos aunque la app esté cerrada.
                  </p>
                  <button className="btn-primary" style={{ width: "100%", justifyContent: "center", opacity: pushEstado === "solicitando" ? 0.6 : 1 }}
                    onClick={activarPush} disabled={pushEstado === "solicitando"}>
                    {pushEstado === "solicitando" ? "Solicitando permiso..." : "Activar notificaciones"}
                  </button>
                </div>
              )}
              {pushEstado === "activo" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(110,231,183,0.08)", border: "1px solid rgba(110,231,183,0.2)", borderRadius: 8, padding: "10px 14px" }}>
                    <span style={{ color: "#6ee7b7", fontSize: 16 }}>✓</span>
                    <span style={{ fontSize: 13, color: "#6ee7b7", fontWeight: 500 }}>Notificaciones activas</span>
                  </div>
                  <button className="btn-ghost" style={{ width: "100%", justifyContent: "center", fontSize: 12 }}
                    onClick={() => {}}>
                    Enviar notificación de prueba
                  </button>
                  <button className="btn-danger" style={{ width: "100%", justifyContent: "center", padding: "8px" }}
                    onClick={desactivarPush}>
                    Desactivar notificaciones
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* CHAT ARCHIVO MODAL */}
      {chatArchivo && <VistaChatArchivo archivo={chatArchivo} onClose={() => setChatArchivo(null)} callIA={async (sys, msgs, mod) => {
        const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ system: sys, messages: msgs, modelo: mod || "claude" }) });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        return data.text;
      }} modelo={localStorage.getItem("utn_modelo") || "claude"} />}

      {/* BOTÓN FLOTANTE FRAZK */}
      <a href="https://www.frazk.lol" target="_blank" rel="noopener noreferrer"
        title="Desarrollado por Franzk — frazk.lol"
        style={{
          position: "fixed", bottom: isMobile ? "76px" : "24px", right: "20px",
          width: 42, height: 42, borderRadius: "50%",
          background: "var(--surface2)", border: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "center",
          textDecoration: "none", zIndex: 40, transition: "all 0.2s",
          boxShadow: "0 2px 12px rgba(0,0,0,0.4)"
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--blue)"; e.currentTarget.style.transform = "scale(1.08)"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.transform = "scale(1)"; }}>
        <span style={{ fontFamily: "'Barlow Condensed'", fontWeight: 800, fontSize: 13, color: "var(--blue)", letterSpacing: 0.5 }}>FK</span>
      </a>
    </>
  );
}