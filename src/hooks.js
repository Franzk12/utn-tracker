import { useState, useEffect, useCallback, useMemo } from "react";
import { TIPO_EVENTO } from "./constants";

export function useIsMobile() {
  const [m, setM] = useState(window.innerWidth < 768);
  useEffect(() => { const fn = () => setM(window.innerWidth < 768); window.addEventListener("resize", fn); return () => window.removeEventListener("resize", fn); }, []);
  return m;
}




export function useToast() {
  const [toasts, setToasts] = useState([]);
  const show = useCallback((msg) => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);
  return { toasts, show };
}

// ─── PUSH NOTIFICATIONS ───────────────────────────────────────────────────────
export function usePushNotifications(userId) {
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
export function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

// ─── NOTIFICACIONES INTERNAS ──────────────────────────────────────────────────
export function useNotificaciones(materias, eventos) {
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
