import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { loadCache, saveCache } from "./offlineCache";
import { mutar, flushQueue, pendingCount } from "./sync";
import { sb } from "./supabase";
import { ESTADOS, DIAS_SEMANA, HORAS, TIPO_EVENTO, MODOS_IA, MODELOS_IA, PLAN_ESTUDIO, MAIN_USER_ID, NAV, TITULOS } from "./constants";
import { G } from "./styles";
import { Icon } from "./components/Icon";
import { ToastContainer, BloqueadoIA, ConfirmModal, Modal, Lbl, Spinner } from "./components/ui";
import { useIsMobile, useToast, usePushNotifications, useNotificaciones } from "./hooks";
import { PanelNotificaciones, AuthPage, Dashboard, VistaAnalisis, VistaEnfoque, FormMateria, VistasMaterias, VistaHorarios, VistaMapa, ImportadorIA, FormEvento, VistaTareas, VistaEventos, VistaArchivos, VistaChatArchivo, VistaAsistente, TutorialModal, VistaPerfil, AvatarBtn } from "./views";






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
  const [profile, setProfile] = useState(null);
  const [showPerfil, setShowPerfil] = useState(false);

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
      new Notification(enfoque.modo === "estudio" ? "¡Bloque terminado!" : "¡Descanso terminado!", { body: enfoque.modo === "estudio" ? "Respondé el quiz antes del descanso." : "Volvemos al estudio." });
    }
    if (enfoque.modo === "estudio") {
      setEnfoque(prev => ({ ...prev, activo: false, target: null }));
      setQuizPendiente(true);
    } else {
      setEnfoque(prev => ({ ...prev, activo: false, modo: "estudio", mins: 25, secs: 0, target: null }));
    }
  };

  const onQuizDone = (correctas, total) => {
    setQuizPendiente(false);
    const target = Date.now() + 5 * 60 * 1000;
    setEnfoque(prev => ({ ...prev, modo: "descanso", mins: 5, secs: 0, activo: true, target }));
    if (total > 0 && session) {
      const materia = materias.find(m => m.id === enfoque.matId);
      if (materia) {
        sb.from("quiz_sessions").insert({
          user_id: session.user.id,
          materia_slug: materia.nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
          materia_nombre: materia.nombre,
          correctas,
          total,
        });
      }
    }
  };

  const startEnfoque = (m, mid) => {
    const mins = m || enfoque.mins;
    const target = Date.now() + (mins * 60 + enfoque.secs) * 1000;
    setEnfoque(prev => ({ ...prev, activo: true, target, matId: mid || prev.matId }));
  };
  const pauseEnfoque = () => setEnfoque(prev => ({ ...prev, activo: false, target: null }));
  const resetEnfoque = () => setEnfoque(prev => ({ ...prev, activo: false, target: null, mins: prev.modo === "estudio" ? 25 : 5, secs: 0 }));
  const setModoEnfoque = (m) => setEnfoque(prev => ({ ...prev, modo: m, mins: m === "estudio" ? 25 : 5, secs: 0, activo: false, target: null }));
  const setMateriaEnfoque = (mid) => setEnfoque(prev => ({ ...prev, matId: mid }));

  const progEnfoque = enfoque.modo === "estudio" ? ((25 - enfoque.mins) * 60 + (60 - enfoque.secs)) / (25 * 60) * 100 : ((5 - enfoque.mins) * 60 + (60 - enfoque.secs)) / (5 * 60) * 100;
  const { toasts, show: showToast } = useToast();
  const [showNotifs, setShowNotifs] = useState(false);
  const [showPushConfig, setShowPushConfig] = useState(false);
  const [iaActiva, setIaActiva] = useState(false);
  const [quizPendiente, setQuizPendiente] = useState(false);

  const userId = session?.user?.id;
  const { estado: pushEstado, activar: activarPush, desactivar: desactivarPush } = usePushNotifications(userId);

  useEffect(() => { setSideOpen(!isMobile); }, [isMobile]);

  useEffect(() => {
    sb.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = sb.auth.onAuthStateChange((_, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      cargarTodo();
      sb.from("profiles").select().eq("id", session.user.id).single().then(({ data }) => {
        if (data) { setProfile(data); }
        else {
          const def = { id: session.user.id, nickname: session.user.email.split("@")[0], avatar_color: "#60a5fa" };
          sb.from("profiles").insert(def);
          setProfile(def);
        }
      });
    } else {
      setMaterias([]); setEventos([]); setTareas([]); setArchivos([]); setCarpetas([]); setLoadingData(false); setProfile(null);
    }
  }, [session]);

  useEffect(() => {
    const off = () => setOnline(false);
    const on = async () => {
      setOnline(true);
      if (!session) return;
      const uid = session.user.id;
      if (pendingCount(uid) > 0) {
        await flushQueue(uid);
        showToast("Cambios sincronizados");
        cargarTodo();
      }
    };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, [session]);

  // Mantener la caché offline en sync con el estado (para ver y editar sin internet)
  useEffect(() => {
    if (session) saveCache(session.user.id, { materias, eventos, tareas, archivos, carpetas });
  }, [session, materias, eventos, tareas, archivos, carpetas]);

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
    // 2) Subir cambios offline pendientes y refrescar desde Supabase
    try {
      await flushQueue(uid);
      const [{ data: m }, { data: e }, { data: t }, { data: a }, { data: c }] = await Promise.all([
        sb.from("materias").select("*").order("año"),
        sb.from("eventos").select("*").order("fecha"),
        sb.from("tareas").select("*").order("vencimiento"),
        sb.from("archivos").select("*").order("created_at", { ascending: false }),
        sb.from("carpetas").select("*").order("nombre"),
      ]);
      setMaterias(m || []);
      setEventos(e || []);
      setTareas(t || []);
      setArchivos(a || []);
      setCarpetas(c || []);
    } catch {
      if (!cached) showToast("Sin conexión y todavía no hay datos guardados.");
    } finally {
      setLoadingData(false);
    }
  };

  const SYNC_MSG = "Guardado sin conexión — se sincroniza al volver internet";
  const addMateria = async (f) => {
    const uid = session.user.id;
    const payload = { ...f, user_id: uid };
    if (payload.nota === "") payload.nota = null;
    const { data, queued, error } = await mutar({ uid, table: "materias", op: "insert", payload });
    if (error) { showToast(error); return; }
    setMaterias(m => [...m, data]);
    if (queued) showToast(SYNC_MSG);
  };
  const editMateria = async (id, f) => {
    const uid = session.user.id;
    const payload = { ...f };
    if (payload.nota === "") payload.nota = null;
    const { data, queued, error } = await mutar({ uid, table: "materias", op: "update", payload, rowId: id });
    if (error) { showToast(error); return; }
    setMaterias(m => m.map(x => x.id === id ? { ...x, ...(data || payload) } : x));
    if (queued) showToast(SYNC_MSG);
  };
  const delMateria = async (id) => {
    const { queued, error } = await mutar({ uid: session.user.id, table: "materias", op: "delete", rowId: id });
    if (error) { showToast(error); return; }
    setMaterias(m => m.filter(x => x.id !== id));
    if (queued) showToast(SYNC_MSG);
  };
  const addEvento = async (f) => {
    const uid = session.user.id;
    const { data, queued, error } = await mutar({ uid, table: "eventos", op: "insert", payload: { ...f, user_id: uid } });
    if (error) { showToast(error); return; }
    setEventos(e => [...e, data]);
    if (queued) showToast(SYNC_MSG);
  };
  const editEvento = async (id, f) => {
    const { data, queued, error } = await mutar({ uid: session.user.id, table: "eventos", op: "update", payload: f, rowId: id });
    if (error) { showToast(error); return; }
    setEventos(e => e.map(x => x.id === id ? { ...x, ...(data || f) } : x));
    if (queued) showToast(SYNC_MSG);
  };
  const delEvento = async (id) => {
    const { queued, error } = await mutar({ uid: session.user.id, table: "eventos", op: "delete", rowId: id });
    if (error) { showToast(error); return; }
    setEventos(e => e.filter(x => x.id !== id));
    if (queued) showToast(SYNC_MSG);
  };

  const onAddTarea = async (f) => {
    const uid = session.user.id;
    const { data, queued, error } = await mutar({ uid, table: "tareas", op: "insert", payload: { ...f, user_id: uid } });
    if (error) { showToast(error); return; }
    setTareas(t => [...t, data]);
    if (queued) showToast(SYNC_MSG);
  };

  const onToggleTarea = async (id, completada) => {
    const { data, queued, error } = await mutar({ uid: session.user.id, table: "tareas", op: "update", payload: { completada }, rowId: id });
    if (error) { showToast(error); return; }
    setTareas(t => t.map(x => x.id === id ? { ...x, ...(data || { completada }) } : x));
    if (queued) showToast(SYNC_MSG);
  };

  const onDeleteTarea = async (id) => {
    const { queued, error } = await mutar({ uid: session.user.id, table: "tareas", op: "delete", rowId: id });
    if (error) { showToast(error); return; }
    setTareas(t => t.filter(x => x.id !== id));
    if (queued) showToast(SYNC_MSG);
  };

  if (session === undefined) return <div style={{ minHeight: "100vh", background: "#0b0e13", display: "flex", alignItems: "center", justifyContent: "center" }}><style>{G}</style><Spinner /></div>;
  if (!session) return <AuthPage onAuth={() => sb.auth.getSession().then(({ data: { session } }) => setSession(session))} />;

  return (
    <>
      <style>{G}</style>
      {!online && (
        <div style={{ background: "#f59e0b", color: "#0b0e13", textAlign: "center", fontSize: 12, fontWeight: 600, padding: "5px 12px", position: "sticky", top: 0, zIndex: 100 }}>
          Sin conexión — tus cambios se guardan y se sincronizan al volver internet
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
          {session && <div style={{ padding: "10px 8px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: sideOpen ? "flex-start" : "center", paddingLeft: sideOpen ? 14 : 8 }}>
            <AvatarBtn profile={profile} session={session} onClick={() => setShowPerfil(true)} />
            {sideOpen && <span style={{ marginLeft: 10, fontSize: 12, color: "var(--text2)", alignSelf: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>{profile?.nickname || session.user.email.split("@")[0]}</span>}
          </div>}
          <button aria-label="Contraer o expandir el menú" onClick={() => setSideOpen(o => !o)} style={{ margin: "9px 6px", padding: "9px", border: "1px solid var(--border)", borderRadius: 6, background: "transparent", color: "var(--text2)", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
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
            <button onClick={() => setShowNotifs(true)} aria-label="Notificaciones" style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 7, padding: "7px 9px", display: "flex", alignItems: "center", cursor: "pointer", transition: "border-color 0.15s", color: "var(--text2)" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--blue)"; e.currentTarget.style.color = "var(--blue)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text2)"; }}>
              <Icon name="bell" size={16} color="currentColor" />
            </button>
            <AvatarBtn profile={profile} session={session} onClick={() => setShowPerfil(true)} />
          </header>
          <div className="main-pad" style={{ flex: 1 }}>
            {loadingData ? <Spinner /> : <>
              {vista === "dashboard" && <Dashboard materias={materias} eventos={eventos} />}
              {vista === "materias" && <VistasMaterias materias={materias} onAdd={addMateria} onEdit={editMateria} onDelete={delMateria} />}
              {vista === "horarios" && <VistaHorarios materias={materias} />}
              {vista === "eventos" && <VistaEventos materias={materias} eventos={eventos} tareas={tareas} onAdd={addEvento} onEdit={editEvento} onDelete={delEvento} onAddTarea={onAddTarea} onToggleTarea={onToggleTarea} onDeleteTarea={onDeleteTarea} />}
              {vista === "enfoque" && <VistaEnfoque materias={materias} sessionEnfoque={{ ...enfoque, progreso: progEnfoque }} onStart={startEnfoque} onPause={pauseEnfoque} onReset={resetEnfoque} onSetModo={setModoEnfoque} onSetMateria={setMateriaEnfoque} quizPendiente={quizPendiente} onQuizDone={onQuizDone} showToast={showToast} />}
              {vista === "archivos" && <VistaArchivos materias={materias} archivos={archivos} carpetas={carpetas} userId={session.user.id} showToast={showToast} onAskIA={(a) => setChatArchivo(a)} onRefresh={cargarTodo} />}
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
              <button aria-label="Cerrar" onClick={() => setShowPushConfig(false)} style={{ background: "none", border: "none", color: "var(--text2)", fontSize: 20, cursor: "pointer" }}>×</button>
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

      {/* PANEL PERFIL */}
      {showPerfil && <VistaPerfil session={session} profile={profile} onProfileSave={setProfile} showToast={showToast} onClose={() => setShowPerfil(false)} />}

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