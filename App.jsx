import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── SUPABASE ────────────────────────────────────────────────────────────────
const SUPA_URL  = "https://dqjfcclrxrnrqutqprcg.supabase.co";
const SUPA_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxamZjY2xyeHJucnF1dHFwcmNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MTI3MDAsImV4cCI6MjA5MjM4ODcwMH0.zevGr2UCe2DfwEXRHYykXEvV4BNcTA6qtK33oRbaHiY";
const sb = createClient(SUPA_URL, SUPA_ANON);

// ─── CONSTANTES ──────────────────────────────────────────────────────────────
const ESTADOS = {
  cursando:       { label:"Cursando",         color:"#60a5fa", bg:"rgba(96,165,250,0.1)"  },
  regular:        { label:"Regular",          color:"#94a3b8", bg:"rgba(148,163,184,0.1)" },
  promocionada:   { label:"Promocionada",     color:"#6ee7b7", bg:"rgba(110,231,183,0.1)" },
  aprobada_final: { label:"Aprobada c/Final", color:"#6ee7b7", bg:"rgba(110,231,183,0.1)" },
  libre:          { label:"Libre",            color:"#f87171", bg:"rgba(248,113,113,0.1)" },
  pendiente:      { label:"Pendiente",        color:"#475569", bg:"rgba(71,85,105,0.15)"  },
};
const DIAS_SEMANA = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
const HORAS       = Array.from({length:14},(_,i)=>`${String(i+7).padStart(2,"0")}:00`);
const TIPO_EVENTO = {
  parcial:{label:"Parcial",color:"#60a5fa"},
  final:  {label:"Final",  color:"#f87171"},
  tp:     {label:"TP",     color:"#6ee7b7"},
  otro:   {label:"Otro",   color:"#94a3b8"},
};
const MODOS_IA = [
  { id:"tutor",      label:"Tutor",       desc:"Te evalúa con preguntas para ver si entendiste el tema"    },
  { id:"planificar", label:"Planificar",  desc:"Te arma un plan de estudio en base a tus días disponibles" },
  { id:"tp",         label:"TP / Código", desc:"Te guía en trabajos prácticos sin darte la respuesta"      },
  { id:"libre",      label:"Chat libre",  desc:"Hacé cualquier consulta académica sin estructura"           },
];
const MODELOS_IA = [
  { id:"claude", label:"Claude Sonnet", color:"#c96442" },
  { id:"gpt",    label:"GPT-4o mini",   color:"#10a37f" },
  { id:"gemini", label:"Gemini Flash",  color:"#4285f4" },
];

// ─── ICON ─────────────────────────────────────────────────────────────────────
const Icon = ({ name, size=16, color="currentColor" }) => {
  const p = {
    dashboard:"M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
    materias: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
    horarios: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    eventos:  "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
    archivos: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z",
    asistente:"M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
    edit:     "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
    trash:    "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
    plus:     "M12 4v16m8-8H4",
    chevronL: "M15 19l-7-7 7-7",
    chevronR: "M9 5l7 7-7 7",
    upload:   "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12",
    signal:   "M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0",
    send:     "M12 19l9 2-9-18-9 18 9-2zm0 0v-8",
    refresh:  "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
    logout:   "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
    warn:     "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
    bell:     "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
    lock:     "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={p[name]}/>
    </svg>
  );
};

// ─── HOOKS ───────────────────────────────────────────────────────────────────
function useIsMobile() {
  const [m,setM]=useState(window.innerWidth<768);
  useEffect(()=>{const fn=()=>setM(window.innerWidth<768);window.addEventListener("resize",fn);return()=>window.removeEventListener("resize",fn);},[]);
  return m;
}

// ─── ESTILOS ─────────────────────────────────────────────────────────────────
const G = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Barlow+Condensed:wght@400;600;700;800&family=Barlow:wght@300;400;500;600&display=swap');
  :root {
    --bg:#0b0e13; --surface:#111418; --surface2:#181c23; --surface3:#1f242d;
    --border:#252b36; --border2:#2f3748;
    --text:#dde3ec; --text2:#7d8899; --text3:#4a5568;
    --blue:#4a90d9; --blue2:#3a7bc8; --blue-dim:rgba(74,144,217,0.1); --blue-mid:rgba(74,144,217,0.2);
    --green:#5aad8f; --red:#c0504d; --slate:#7a8fa8;
    --radius:7px; --radius2:10px; --nav-h:58px;
  }
  *{box-sizing:border-box;margin:0;padding:0;}
  html,body{height:100%;}
  body{background:var(--bg);color:var(--text);font-family:'Barlow',sans-serif;min-height:100vh;-webkit-font-smoothing:antialiased;}
  ::-webkit-scrollbar{width:5px;height:5px;}
  ::-webkit-scrollbar-track{background:var(--surface);}
  ::-webkit-scrollbar-thumb{background:var(--border2);border-radius:3px;}
  input,select,textarea{background:var(--surface2);border:1px solid var(--border);color:var(--text);padding:8px 12px;border-radius:var(--radius);font-family:'Barlow',sans-serif;font-size:14px;outline:none;transition:border-color 0.2s;}
  input:focus,select:focus,textarea:focus{border-color:var(--blue);}
  option{background:var(--surface2);}
  button{cursor:pointer;font-family:'Barlow',sans-serif;}
  .mono{font-family:'DM Mono',monospace;}
  .tag{display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:4px;font-size:11px;font-weight:500;letter-spacing:0.3px;white-space:nowrap;}
  .card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius2);}
  .btn-primary{background:var(--blue);color:#fff;border:none;padding:8px 18px;border-radius:var(--radius);font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:6px;transition:background 0.2s;}
  .btn-primary:hover{background:var(--blue2);}
  .btn-ghost{background:transparent;color:var(--text2);border:1px solid var(--border);padding:7px 14px;border-radius:var(--radius);font-size:13px;display:inline-flex;align-items:center;gap:6px;transition:all 0.2s;}
  .btn-ghost:hover{border-color:var(--blue);color:var(--blue);}
  .btn-danger{background:transparent;color:var(--red);border:1px solid rgba(192,80,77,0.25);padding:6px 10px;border-radius:var(--radius);font-size:12px;display:inline-flex;align-items:center;transition:all 0.2s;}
  .btn-danger:hover{background:rgba(192,80,77,0.1);}
  .section-title{font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--text3);margin-bottom:12px;}
  .field-error{font-size:11px;color:var(--red);margin-top:4px;}
  @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
  .fade-in{animation:fadeIn 0.2s ease forwards;}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
  .pulse{animation:pulse 1.4s ease infinite;}
  @keyframes toastIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  .sidebar{display:flex;}
  .bottom-nav{display:none;}
  .main-pad{padding:22px 26px;}
  .header-pad{padding:16px 26px;}
  @media(max-width:767px){
    .sidebar{display:none !important;}
    .bottom-nav{display:flex !important;}
    .main-pad{padding:16px 14px 80px;}
    .header-pad{padding:14px 16px;}
  }
`;

// ─── TOAST ────────────────────────────────────────────────────────────────────
function ToastContainer({ toasts }) {
  return (
    <div style={{position:"fixed",bottom:24,right:20,zIndex:999,display:"flex",flexDirection:"column",gap:8,pointerEvents:"none"}}>
      {toasts.map(t=>(
        <div key={t.id} style={{background:"#1e1a18",border:"1px solid rgba(192,80,77,0.4)",borderLeft:"3px solid var(--red)",borderRadius:8,padding:"11px 16px",maxWidth:320,display:"flex",alignItems:"center",gap:10,animation:"toastIn 0.25s ease",boxShadow:"0 4px 20px rgba(0,0,0,0.5)"}}>
          <Icon name="warn" size={15} color="var(--red)"/>
          <span style={{fontSize:12,color:"var(--text)",lineHeight:1.4}}>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts,setToasts]=useState([]);
  const show=useCallback((msg)=>{
    const id=Date.now();
    setToasts(t=>[...t,{id,msg}]);
    setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),4000);
  },[]);
  return {toasts,show};
}

// ─── NOTIFICACIONES INTERNAS ──────────────────────────────────────────────────
function useNotificaciones(materias, eventos) {
  return useMemo(() => {
    const notifs = [];
    const hoy = new Date();
    const diasSem = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
    const dHoy = diasSem[hoy.getDay()];

    // Materias de hoy
    const matHoy = materias.filter(m => m.dias?.includes(dHoy) && ["cursando","regular"].includes(m.estado));
    if (matHoy.length > 0) {
      notifs.push({
        id:"hoy",
        tipo:"info",
        titulo:`${matHoy.length} ${matHoy.length===1?"materia":"materias"} hoy`,
        detalle: matHoy.map(m=>`${m.horario} · ${m.nombre}`).join(" / "),
        icon:"horarios",
      });
    }

    // Eventos próximos (7 días)
    eventos.filter(e=>{
      const d=Math.ceil((new Date(e.fecha)-hoy)/86400000);
      return d>=0&&d<=7;
    }).sort((a,b)=>new Date(a.fecha)-new Date(b.fecha)).forEach(ev=>{
      const d=Math.ceil((new Date(ev.fecha)-hoy)/86400000);
      const mat=materias.find(m=>m.id===ev.materia_id);
      const tipo=TIPO_EVENTO[ev.tipo];
      notifs.push({
        id:`ev_${ev.id}`,
        tipo: d<=1?"urgente":"aviso",
        titulo: d===0?`Hoy: ${ev.titulo}`: d===1?`Mañana: ${ev.titulo}`:`En ${d}d: ${ev.titulo}`,
        detalle: `${mat?.nombre||""}${ev.descripcion?" · "+ev.descripcion:""}`,
        color: tipo?.color,
        icon:"eventos",
      });
    });

    // Materias libres (recordatorio)
    const libres = materias.filter(m=>m.estado==="libre");
    if (libres.length > 0) {
      notifs.push({
        id:"libres",
        tipo:"warning",
        titulo:`${libres.length} ${libres.length===1?"materia libre":"materias libres"} para recursar`,
        detalle: libres.map(m=>m.nombre).join(", "),
        icon:"warn",
      });
    }

    // Finales próximos (30 días)
    const finales=eventos.filter(e=>{
      const d=Math.ceil((new Date(e.fecha)-hoy)/86400000);
      return e.tipo==="final"&&d>=0&&d<=30;
    });
    if(finales.length>0){
      notifs.push({
        id:"finales",
        tipo:"aviso",
        titulo:`${finales.length} ${finales.length===1?"final":"finales"} en los próximos 30 días`,
        detalle: finales.map(e=>{const d=Math.ceil((new Date(e.fecha)-hoy)/86400000);return `${e.titulo} (${d===0?"hoy":d+"d"})`;}).join(", "),
        icon:"eventos",
        color:"#f87171",
      });
    }

    return notifs;
  }, [materias, eventos]);
}

function PanelNotificaciones({ materias, eventos, onClose }) {
  const notifs = useNotificaciones(materias, eventos);
  const colores = {
    urgente: { bg:"rgba(248,113,113,0.1)", border:"rgba(248,113,113,0.35)", color:"#f87171" },
    aviso:   { bg:"rgba(74,144,217,0.1)",  border:"rgba(74,144,217,0.3)",   color:"#4a90d9" },
    info:    { bg:"rgba(110,231,183,0.08)",border:"rgba(110,231,183,0.25)", color:"#6ee7b7" },
    warning: { bg:"rgba(251,191,36,0.08)", border:"rgba(251,191,36,0.25)",  color:"#fbbf24" },
  };
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="card fade-in" style={{width:"100%",maxWidth:440,margin:"auto",padding:0,overflow:"hidden"}}>
        <div style={{padding:"16px 20px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <Icon name="bell" size={16} color="var(--blue)"/>
            <span style={{fontFamily:"'Barlow Condensed'",fontSize:17,fontWeight:700}}>Notificaciones</span>
            {notifs.length>0&&<span style={{background:"var(--blue)",color:"#fff",borderRadius:10,fontSize:10,fontWeight:700,padding:"1px 7px"}}>{notifs.length}</span>}
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"var(--text2)",fontSize:20,cursor:"pointer",padding:4}}>×</button>
        </div>
        <div style={{maxHeight:"70vh",overflowY:"auto",padding:"12px 16px",display:"flex",flexDirection:"column",gap:8}}>
          {notifs.length===0?(
            <div style={{textAlign:"center",padding:"32px 0",color:"var(--text2)",fontSize:13}}>
              Sin notificaciones por ahora
            </div>
          ):notifs.map(n=>{
            const c=colores[n.tipo]||colores.info;
            return(
              <div key={n.id} style={{background:c.bg,border:`1px solid ${n.color||c.border}22`,borderLeft:`3px solid ${n.color||c.color}`,borderRadius:8,padding:"11px 14px"}}>
                <div style={{fontSize:13,fontWeight:600,color:n.color||c.color,marginBottom:3}}>{n.titulo}</div>
                {n.detalle&&<div style={{fontSize:11,color:"var(--text2)",lineHeight:1.5}}>{n.detalle}</div>}
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
    <div className="fade-in" style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:360,gap:20,padding:32,textAlign:"center"}}>
      <div style={{width:56,height:56,borderRadius:14,background:"var(--surface2)",border:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <Icon name="lock" size={24} color="var(--text3)"/>
      </div>
      <div>
        <div style={{fontFamily:"'Barlow Condensed'",fontSize:20,fontWeight:700,marginBottom:8}}>Asistente IA no activado</div>
        <div style={{fontSize:13,color:"var(--text2)",lineHeight:1.7,maxWidth:320}}>
          Esta función requiere activación. Contactá al administrador del sistema para obtener acceso al asistente de estudio con IA.
        </div>
      </div>
      <div style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:8,padding:"10px 18px",fontSize:12,color:"var(--text2)"}}>
        franzk.dev — contacto para extensiones
      </div>
    </div>
  );
}
function ConfirmModal({nombre,onConfirm,onClose}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="card fade-in" style={{maxWidth:360,width:"100%",padding:24}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
          <Icon name="warn" size={20} color="var(--red)"/>
          <span style={{fontFamily:"'Barlow Condensed'",fontSize:16,fontWeight:700}}>Confirmar eliminación</span>
        </div>
        <p style={{fontSize:13,color:"var(--text2)",lineHeight:1.6,marginBottom:20}}>
          ¿Eliminar <strong style={{color:"var(--text)"}}>{nombre}</strong>? Esta acción no se puede deshacer.
        </p>
        <div style={{display:"flex",gap:8}}>
          <button className="btn-ghost" style={{flex:1,justifyContent:"center"}} onClick={onClose}>Cancelar</button>
          <button style={{flex:1,padding:"8px",borderRadius:"var(--radius)",border:"none",background:"var(--red)",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}} onClick={onConfirm}>
            <Icon name="trash" size={13} color="#fff"/>Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SHARED ───────────────────────────────────────────────────────────────────
function Modal({title,onClose,children,width=520}){
  const innerRef=useRef(null);
  useEffect(()=>{
    const fn=e=>e.key==="Escape"&&onClose();
    window.addEventListener("keydown",fn);
    setTimeout(()=>{
      const first=innerRef.current?.querySelector("input,select,textarea");
      if(first) first.focus();
    },50);
    return()=>window.removeEventListener("keydown",fn);
  },[onClose]);
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:200,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:16,paddingTop:"4vh",overflowY:"auto"}}      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div ref={innerRef} className="card fade-in" style={{
        width:"100%",maxWidth:width,
        maxHeight:"calc(100vh - 48px)",
        display:"flex",flexDirection:"column",
        position:"relative"
      }}>
        {/* Header fijo */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"18px 24px 0",flexShrink:0}}>
          <span style={{fontFamily:"'Barlow Condensed'",fontSize:17,fontWeight:700}}>{title}</span>
          <button onClick={onClose} style={{background:"none",border:"none",color:"var(--text2)",fontSize:20,lineHeight:1,padding:4,cursor:"pointer"}}>×</button>
        </div>
        {/* Contenido con scroll */}
        <div style={{overflowY:"auto",padding:"16px 24px 24px",flex:1}}>
          {children}
        </div>
      </div>
    </div>
  );
}
function Lbl({children}){return <label style={{fontSize:11,color:"var(--text2)",marginBottom:5,display:"block",fontWeight:500}}>{children}</label>;}
function Spinner(){return <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:40,color:"var(--text2)",fontSize:13,gap:10}}><div style={{width:18,height:18,border:"2px solid var(--border2)",borderTop:"2px solid var(--blue)",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>Cargando...</div>;}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
function AuthPage({onAuth}){
  const [modo,setModo]=useState("login");
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [nombre,setNombre]=useState("");
  const [err,setErr]=useState("");
  const [loading,setLoading]=useState(false);
  const [ok,setOk]=useState(false);
  const submit=async()=>{
    setErr("");setLoading(true);
    if(modo==="login"){
      const {error}=await sb.auth.signInWithPassword({email,password:pass});
      if(error)setErr(error.message);else onAuth();
    }else{
      const {error}=await sb.auth.signUp({email,password:pass,options:{data:{nombre}}});
      if(error)setErr(error.message);else setOk(true);
    }
    setLoading(false);
  };
  return(
    <div style={{minHeight:"100vh",background:"var(--bg)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <style>{G}</style>
      <div className="card" style={{width:"100%",maxWidth:380,padding:32}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{width:44,height:44,background:"var(--blue)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Barlow Condensed'",fontWeight:800,color:"#fff",fontSize:22,margin:"0 auto 12px"}}>U</div>
          <div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:22,letterSpacing:0.5}}>UTN TRACKER</div>
          <div style={{fontSize:11,color:"var(--text3)",letterSpacing:1.5,marginTop:2}}>SISTEMAS · TUC</div>
        </div>
        {ok?(
          <div style={{textAlign:"center",color:"var(--text2)",fontSize:13,lineHeight:1.6}}>
            <div style={{fontSize:28,marginBottom:12,color:"var(--green)"}}>✓</div>
            Revisá tu email para confirmar la cuenta y luego iniciá sesión.
            <button className="btn-ghost" style={{marginTop:16,width:"100%",justifyContent:"center"}} onClick={()=>{setOk(false);setModo("login");}}>Ir al login</button>
          </div>
        ):(
          <>
            <div style={{display:"flex",gap:6,marginBottom:20,background:"var(--surface2)",borderRadius:8,padding:4}}>
              {["login","registro"].map(m=>(
                <button key={m} onClick={()=>{setModo(m);setErr("");}} style={{flex:1,padding:"7px",borderRadius:6,border:"none",background:modo===m?"var(--blue)":"transparent",color:modo===m?"#fff":"var(--text2)",fontSize:13,fontWeight:modo===m?600:400,transition:"all 0.15s"}}>
                  {m==="login"?"Iniciar sesión":"Registrarse"}
                </button>
              ))}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {modo==="registro"&&<div><Lbl>Nombre</Lbl><input style={{width:"100%"}} value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Tu nombre"/></div>}
              <div><Lbl>Email</Lbl><input style={{width:"100%"}} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@email.com"/></div>
              <div><Lbl>Contraseña</Lbl><input style={{width:"100%"}} type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&submit()}/></div>
              {err&&<div style={{fontSize:12,color:"var(--red)",background:"rgba(192,80,77,0.1)",padding:"8px 12px",borderRadius:6}}>{err}</div>}
              <button className="btn-primary" style={{width:"100%",justifyContent:"center",marginTop:4,opacity:loading?0.6:1}} onClick={submit} disabled={loading}>
                {loading?"Cargando...":(modo==="login"?"Entrar":"Crear cuenta")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
function Dashboard({materias,eventos}){
  const hoy=new Date();
  const stats=useMemo(()=>{
    const total=materias.length;
    const aprobadas=materias.filter(m=>m.estado==="aprobada_final"||m.estado==="promocionada").length;
    const cursando=materias.filter(m=>m.estado==="cursando").length;
    const regulares=materias.filter(m=>m.estado==="regular").length;
    const libres=materias.filter(m=>m.estado==="libre").length;
    const notas=materias.filter(m=>m.nota).map(m=>m.nota);
    const promedio=notas.length?(notas.reduce((a,b)=>a+b,0)/notas.length).toFixed(1):"—";
    const progreso=total?Math.round((aprobadas/total)*100):0;
    return{total,aprobadas,cursando,regulares,libres,promedio,progreso};
  },[materias]);
  const prox=eventos.filter(e=>new Date(e.fecha)>=hoy).sort((a,b)=>new Date(a.fecha)-new Date(b.fecha)).slice(0,5);
  const dR=f=>{const d=Math.ceil((new Date(f)-hoy)/86400000);return d===0?"Hoy":d===1?"Mañana":`${d}d`;};
  const SC=({label,value,sub,accent="var(--text)"})=>(
    <div className="card" style={{padding:"16px 18px"}}>
      <div style={{fontSize:10,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"var(--text3)",marginBottom:5}}>{label}</div>
      <div style={{fontFamily:"'Barlow Condensed'",fontSize:34,fontWeight:800,color:accent,lineHeight:1}}>{value}</div>
      {sub&&<div style={{fontSize:11,color:"var(--text2)",marginTop:3}}>{sub}</div>}
    </div>
  );
  const diasSem=["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
  const dHoy=diasSem[hoy.getDay()];
  const matHoy=materias.filter(m=>m.dias?.includes(dHoy)&&["cursando","regular"].includes(m.estado));
  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",gap:20}}>
      <p style={{color:"var(--text2)",fontSize:13}}>Resumen de tu situación académica.</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:9}}>
        <SC label="Progreso" value={`${stats.progreso}%`} sub={`${stats.aprobadas} de ${stats.total}`} accent="var(--blue)"/>
        <SC label="Cursando" value={stats.cursando} sub="activas" accent="var(--blue)"/>
        <SC label="Regulares" value={stats.regulares} sub="para final" accent="var(--slate)"/>
        <SC label="Libres" value={stats.libres} sub="a recursar" accent="var(--red)"/>
        <SC label="Promedio" value={stats.promedio} sub="notas"/>
      </div>
      <div className="card" style={{padding:"16px 18px"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:9}}>
          <span style={{fontSize:13,fontWeight:600}}>Avance de carrera</span>
          <span style={{fontFamily:"'DM Mono'",fontSize:12,color:"var(--blue)"}}>{stats.aprobadas}/{stats.total}</span>
        </div>
        <div style={{background:"var(--surface3)",borderRadius:3,height:5}}>
          <div style={{height:"100%",width:`${stats.progreso}%`,background:"var(--blue)",borderRadius:3,transition:"width 0.6s"}}/>
        </div>
        <div style={{display:"flex",gap:7,marginTop:12,flexWrap:"wrap"}}>
          {Object.entries(ESTADOS).map(([k,v])=>{const c=materias.filter(m=>m.estado===k).length;return c?<span key={k} className="tag" style={{background:v.bg,color:v.color}}>{v.label} {c}</span>:null;})}
        </div>
      </div>
      {prox.length>0&&(
        <div>
          <p className="section-title">Próximos eventos</p>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {prox.map(ev=>{
              const mat=materias.find(m=>m.id===ev.materia_id);
              const tipo=TIPO_EVENTO[ev.tipo];
              return(
                <div key={ev.id} className="card" style={{padding:"11px 14px",display:"flex",alignItems:"center",gap:11}}>
                  <div style={{width:3,height:34,borderRadius:2,background:tipo.color,flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:2,flexWrap:"wrap"}}>
                      <span style={{fontSize:13,fontWeight:600}}>{ev.titulo}</span>
                      <span className="tag" style={{background:`${tipo.color}18`,color:tipo.color}}>{tipo.label}</span>
                    </div>
                    <span style={{fontSize:11,color:"var(--text2)"}}>{mat?.nombre}{ev.descripcion&&` · ${ev.descripcion}`}</span>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontFamily:"'DM Mono'",fontSize:12,color:"var(--blue)",fontWeight:500}}>{dR(ev.fecha)}</div>
                    <div style={{fontSize:10,color:"var(--text3)",marginTop:1}}>{new Date(ev.fecha+"T00:00:00").toLocaleDateString("es-AR",{day:"2-digit",month:"short"})}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div>
        <p className="section-title">Hoy — {dHoy}</p>
        {matHoy.length===0?<div className="card" style={{padding:14,color:"var(--text2)",fontSize:13}}>No hay clases cargadas para hoy</div>:(
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {matHoy.map(m=>{const est=ESTADOS[m.estado];return(
              <div key={m.id} className="card" style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:11}}>
                <span style={{fontFamily:"'DM Mono'",fontSize:12,color:"var(--blue)",minWidth:44}}>{m.horario}</span>
                <span style={{flex:1,fontSize:13,fontWeight:500}}>{m.nombre}</span>
                <span style={{fontSize:11,color:"var(--text2)"}}>Aula {m.aula}</span>
                <span className="tag" style={{background:est.bg,color:est.color}}>{est.label}</span>
              </div>
            );})}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MATERIAS ─────────────────────────────────────────────────────────────────
function FormMateria({initial,onSave,onClose}){
  const [f,setF]=useState(initial||{nombre:"",año:1,cuatrimestre:1,estado:"pendiente",nota:"",hs:4,dias:[],horario:"08:00",aula:""});
  const [errs,setErrs]=useState({});
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const tD=d=>s("dias",f.dias?.includes(d)?f.dias.filter(x=>x!==d):[...(f.dias||[]),d]);
  const nN=["aprobada_final","promocionada","regular"].includes(f.estado);

  const validar=()=>{
    const e={};
    if(!f.nombre.trim()) e.nombre="El nombre es requerido";
    if(nN&&f.nota!==""){
      const n=Number(f.nota);
      if(isNaN(n)||n<1||n>10) e.nota="La nota debe ser entre 1 y 10";
    }
    setErrs(e);
    return Object.keys(e).length===0;
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:13}}>
      <div>
        <Lbl>Nombre</Lbl>
        <input style={{width:"100%",borderColor:errs.nombre?"var(--red)":undefined}} value={f.nombre} onChange={e=>{s("nombre",e.target.value);setErrs(p=>({...p,nombre:""}));}} placeholder="Ej: Algoritmos y Estructura de Datos"/>
        {errs.nombre&&<div className="field-error">{errs.nombre}</div>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:9}}>
        <div><Lbl>Año</Lbl><select style={{width:"100%"}} value={f.año} onChange={e=>s("año",+e.target.value)}>{[1,2,3,4,5].map(n=><option key={n}>{n}</option>)}</select></div>
        <div><Lbl>Cuatrimestre</Lbl><select style={{width:"100%"}} value={f.cuatrimestre} onChange={e=>s("cuatrimestre",+e.target.value)}><option value={1}>1°</option><option value={2}>2°</option></select></div>
        <div><Lbl>Hs/sem</Lbl><input type="number" style={{width:"100%"}} value={f.hs} onChange={e=>s("hs",+e.target.value)} min={1} max={12}/></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
        <div><Lbl>Estado</Lbl><select style={{width:"100%"}} value={f.estado} onChange={e=>s("estado",e.target.value)}>{Object.entries(ESTADOS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div>
        {nN&&<div>
          <Lbl>Nota</Lbl>
          <input type="number" style={{width:"100%",borderColor:errs.nota?"var(--red)":undefined}} value={f.nota||""} onChange={e=>{s("nota",e.target.value);setErrs(p=>({...p,nota:""}));}} min={1} max={10} placeholder="1–10"/>
          {errs.nota&&<div className="field-error">{errs.nota}</div>}
        </div>}
      </div>
      <div>
        <Lbl>Días de cursado</Lbl>
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          {DIAS_SEMANA.map(d=>(
            <button key={d} onClick={()=>tD(d)} style={{padding:"5px 10px",borderRadius:5,fontSize:12,border:`1px solid ${f.dias?.includes(d)?"var(--blue)":"var(--border)"}`,background:f.dias?.includes(d)?"var(--blue-dim)":"transparent",color:f.dias?.includes(d)?"var(--blue)":"var(--text2)",transition:"all 0.15s"}}>{d}</button>
          ))}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
        <div><Lbl>Horario</Lbl><select style={{width:"100%"}} value={f.horario} onChange={e=>s("horario",e.target.value)}>{HORAS.map(h=><option key={h}>{h}</option>)}</select></div>
        <div><Lbl>Aula</Lbl><input style={{width:"100%"}} value={f.aula} onChange={e=>s("aula",e.target.value)} placeholder="Ej: Lab1"/></div>
      </div>
      <div style={{display:"flex",gap:8,marginTop:4}}>
        <button className="btn-primary" style={{flex:1}} onClick={()=>{if(validar())onSave(f);}}>{initial?"Guardar cambios":"Agregar materia"}</button>
        <button className="btn-ghost" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}

function VistasMaterias({materias,onAdd,onEdit,onDelete}){
  const [filtro,setFiltro]=useState("all");
  const [busq,setBusq]=useState("");
  const [edit,setEdit]=useState(null);
  const [add,setAdd]=useState(false);
  const [confirm,setConfirm]=useState(null); // {id, nombre}
  const fil=useMemo(()=>materias.filter(m=>(filtro==="all"||m.estado===filtro)&&m.nombre.toLowerCase().includes(busq.toLowerCase())).sort((a,b)=>a.año-b.año||a.cuatrimestre-b.cuatrimestre),[materias,filtro,busq]);
  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",gap:13}}>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
        <input style={{flex:1,minWidth:160}} value={busq} onChange={e=>setBusq(e.target.value)} placeholder="Buscar materia..."/>
        <select value={filtro} onChange={e=>setFiltro(e.target.value)} style={{minWidth:140}}>
          <option value="all">Todos los estados</option>
          {Object.entries(ESTADOS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
        <button className="btn-primary" onClick={()=>setAdd(true)}><Icon name="plus" size={14} color="#fff"/>Agregar</button>
      </div>
      <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
        {["all",...Object.keys(ESTADOS)].map(k=>{
          const c=k==="all"?materias.length:materias.filter(m=>m.estado===k).length;
          const est=k==="all"?null:ESTADOS[k];const ac=filtro===k;
          return <button key={k} onClick={()=>setFiltro(k)} style={{padding:"3px 10px",borderRadius:4,fontSize:11,fontWeight:500,border:`1px solid ${ac?(est?.color||"var(--blue)"):"var(--border)"}`,background:ac?(est?.bg||"var(--blue-dim)"):"transparent",color:ac?(est?.color||"var(--blue)"):"var(--text2)",transition:"all 0.15s"}}>{k==="all"?"Todas":est.label} ({c})</button>;
        })}
      </div>
      {fil.length===0?<div className="card" style={{padding:24,textAlign:"center",color:"var(--text2)",fontSize:13}}>Sin resultados</div>:(
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {fil.map(m=>{const est=ESTADOS[m.estado];return(
            <div key={m.id} className="card" style={{padding:"11px 14px",display:"flex",alignItems:"center",gap:11,transition:"border-color 0.15s"}}
              onMouseEnter={e=>e.currentTarget.style.borderColor="var(--border2)"}
              onMouseLeave={e=>e.currentTarget.style.borderColor="var(--border)"}>
              <div style={{width:3,alignSelf:"stretch",borderRadius:2,background:est.color,flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:3,flexWrap:"wrap"}}>
                  <span style={{fontSize:13,fontWeight:600}}>{m.nombre}</span>
                  <span className="tag" style={{background:est.bg,color:est.color}}>{est.label}</span>
                  {m.nota&&<span className="mono tag" style={{background:"var(--blue-dim)",color:"var(--blue)",fontSize:10}}>{m.nota}/10</span>}
                </div>
                <div style={{fontSize:11,color:"var(--text2)",display:"flex",gap:10,flexWrap:"wrap"}}>
                  <span>Año {m.año} · {m.cuatrimestre}° cuat.</span>
                  {m.dias?.length>0&&<span>{m.dias.join(", ")} · {m.horario}</span>}
                  {m.aula&&<span>Aula: {m.aula}</span>}
                  <span>{m.hs} hs/sem</span>
                </div>
              </div>
              <div style={{display:"flex",gap:6,flexShrink:0}}>
                <button className="btn-ghost" style={{padding:"5px 9px",fontSize:12}} onClick={()=>setEdit(m)}><Icon name="edit" size={13}/>Editar</button>
                <button className="btn-danger" onClick={()=>setConfirm({id:m.id,nombre:m.nombre})}><Icon name="trash" size={13}/></button>
              </div>
            </div>
          );})}
        </div>
      )}
      {add&&<Modal title="Nueva Materia" onClose={()=>setAdd(false)}><FormMateria onSave={f=>{onAdd(f);setAdd(false);}} onClose={()=>setAdd(false)}/></Modal>}
      {edit&&<Modal title="Editar Materia" onClose={()=>setEdit(null)}><FormMateria initial={edit} onSave={f=>{onEdit(edit.id,f);setEdit(null);}} onClose={()=>setEdit(null)}/></Modal>}
      {confirm&&<ConfirmModal nombre={confirm.nombre} onClose={()=>setConfirm(null)} onConfirm={()=>{onDelete(confirm.id);setConfirm(null);}}/>}
    </div>
  );
}

// ─── HORARIOS ─────────────────────────────────────────────────────────────────
function VistaHorarios({materias}){
  const cur=materias.filter(m=>["cursando","regular"].includes(m.estado)&&m.dias?.length>0);
  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",gap:13}}>
      <div style={{overflowX:"auto"}}>
        <div style={{minWidth:640}}>
          <div style={{display:"grid",gridTemplateColumns:"60px repeat(6,1fr)",gap:2,marginBottom:2}}>
            <div/>{DIAS_SEMANA.map(d=><div key={d} style={{background:"var(--surface2)",borderRadius:5,padding:"7px 0",textAlign:"center",fontFamily:"'Barlow Condensed'",fontSize:11,fontWeight:700,letterSpacing:1,color:"var(--text2)"}}>{d}</div>)}
          </div>
          {HORAS.map(hora=>{
            const ok=DIAS_SEMANA.some(d=>cur.some(m=>m.horario===hora&&m.dias.includes(d)));
            return(
              <div key={hora} style={{display:"grid",gridTemplateColumns:"60px repeat(6,1fr)",gap:2,marginBottom:2}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",paddingRight:8,fontFamily:"'DM Mono'",fontSize:10,color:ok?"var(--blue)":"var(--text3)"}}>{hora}</div>
                {DIAS_SEMANA.map(dia=>{
                  const m=cur.find(x=>x.horario===hora&&x.dias.includes(dia));
                  const est=m?ESTADOS[m.estado]:null;
                  return <div key={dia} style={{background:m?est.bg:"var(--surface)",minHeight:36,border:`1px solid ${m?est.color+"33":"var(--border)"}`,borderRadius:5,padding:m?"6px 8px":"3px",display:"flex",flexDirection:"column",justifyContent:"center"}}>
                    {m&&<><span style={{fontSize:10,fontWeight:600,color:est.color,lineHeight:1.3}}>{m.nombre.length>22?m.nombre.slice(0,22)+"…":m.nombre}</span><span style={{fontSize:9,color:"var(--text2)",marginTop:1}}>Aula {m.aula}</span></>}
                  </div>;
                })}
              </div>
            );
          })}
        </div>
      </div>
      <div><p className="section-title">Referencias</p>
        <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
          {Object.entries(ESTADOS).filter(([k])=>["cursando","regular"].includes(k)).map(([k,v])=><span key={k} className="tag" style={{background:v.bg,color:v.color}}>{v.label}</span>)}
        </div>
      </div>
    </div>
  );
}

// ─── EVENTOS ──────────────────────────────────────────────────────────────────
function FormEvento({materias,initial,onSave,onClose}){
  const [f,setF]=useState(initial||{materia_id:materias[0]?.id||"",tipo:"parcial",titulo:"",fecha:"",hora:"09:00",descripcion:""});
  const [errs,setErrs]=useState({});
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const validar=()=>{
    const e={};
    if(!f.titulo||f.titulo.trim().length<3) e.titulo="El título debe tener al menos 3 caracteres";
    if(!f.fecha) e.fecha="La fecha es requerida";
    setErrs(e);
    return Object.keys(e).length===0;
  };
  return(
    <div style={{display:"flex",flexDirection:"column",gap:13}}>
      <div><Lbl>Materia</Lbl><select style={{width:"100%"}} value={f.materia_id} onChange={e=>s("materia_id",e.target.value)}>{materias.map(m=><option key={m.id} value={m.id}>{m.nombre}</option>)}</select></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
        <div><Lbl>Tipo</Lbl><select style={{width:"100%"}} value={f.tipo} onChange={e=>s("tipo",e.target.value)}>{Object.entries(TIPO_EVENTO).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div>
        <div>
          <Lbl>Fecha</Lbl>
          <input type="date" style={{width:"100%",colorScheme:"dark",borderColor:errs.fecha?"var(--red)":undefined}} value={f.fecha} onChange={e=>{s("fecha",e.target.value);setErrs(p=>({...p,fecha:""}));}}/>
          {errs.fecha&&<div className="field-error">{errs.fecha}</div>}
        </div>
      </div>
      <div>
        <Lbl>Título</Lbl>
        <input style={{width:"100%",borderColor:errs.titulo?"var(--red)":undefined}} value={f.titulo} onChange={e=>{s("titulo",e.target.value);setErrs(p=>({...p,titulo:""}));}} placeholder="Ej: 1er Parcial"/>
        {errs.titulo&&<div className="field-error">{errs.titulo}</div>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
        <div><Lbl>Hora</Lbl><select style={{width:"100%"}} value={f.hora} onChange={e=>s("hora",e.target.value)}>{HORAS.map(h=><option key={h}>{h}</option>)}</select></div>
        <div><Lbl>Descripción</Lbl><input style={{width:"100%"}} value={f.descripcion} onChange={e=>s("descripcion",e.target.value)} placeholder="Temas, etc."/></div>
      </div>
      <div style={{display:"flex",gap:8,marginTop:4}}>
        <button className="btn-primary" style={{flex:1}} onClick={()=>{if(validar())onSave(f);}}>{initial?"Guardar":"Agregar evento"}</button>
        <button className="btn-ghost" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}

function VistaEventos({materias,eventos,onAdd,onEdit,onDelete}){
  const [edit,setEdit]=useState(null);
  const [add,setAdd]=useState(false);
  const [ft,setFt]=useState("all");
  const [confirm,setConfirm]=useState(null);
  const hoy=new Date();
  const fil=useMemo(()=>eventos.filter(e=>ft==="all"||e.tipo===ft).sort((a,b)=>new Date(a.fecha)-new Date(b.fecha)),[eventos,ft]);
  const prox=fil.filter(e=>new Date(e.fecha)>=hoy);
  const pas=fil.filter(e=>new Date(e.fecha)<hoy);
  const Row=({ev})=>{
    const mat=materias.find(m=>m.id===ev.materia_id);
    const tipo=TIPO_EVENTO[ev.tipo];
    const past=new Date(ev.fecha)<hoy;
    const d=Math.ceil((new Date(ev.fecha)-hoy)/86400000);
    const lbl=past?"Pasado":d===0?"Hoy":d===1?"Mañana":`${d}d`;
    return(
      <div className="card" style={{padding:"11px 14px",display:"flex",alignItems:"center",gap:11,opacity:past?0.45:1}}>
        <div style={{width:3,height:36,borderRadius:2,background:tipo.color,flexShrink:0}}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:2,flexWrap:"wrap"}}>
            <span style={{fontSize:13,fontWeight:600}}>{ev.titulo}</span>
            <span className="tag" style={{background:`${tipo.color}18`,color:tipo.color}}>{tipo.label}</span>
          </div>
          <span style={{fontSize:11,color:"var(--text2)"}}>{mat?.nombre}{ev.descripcion&&` · ${ev.descripcion}`}</span>
        </div>
        <div style={{textAlign:"right",flexShrink:0,minWidth:64}}>
          <div style={{fontFamily:"'DM Mono'",fontSize:12,color:past?"var(--text3)":"var(--blue)",fontWeight:500}}>{lbl}</div>
          <div style={{fontSize:10,color:"var(--text3)",marginTop:1}}>{new Date(ev.fecha+"T00:00:00").toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"2-digit"})} · {ev.hora}</div>
        </div>
        <div style={{display:"flex",gap:5}}>
          <button className="btn-ghost" style={{padding:"5px 8px"}} onClick={()=>setEdit(ev)}><Icon name="edit" size={13}/></button>
          <button className="btn-danger" onClick={()=>setConfirm({id:ev.id,nombre:ev.titulo})}><Icon name="trash" size={13}/></button>
        </div>
      </div>
    );
  };
  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",gap:13}}>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{display:"flex",gap:5,flex:1,flexWrap:"wrap"}}>
          {["all",...Object.keys(TIPO_EVENTO)].map(k=>{const t=k==="all"?null:TIPO_EVENTO[k];const ac=ft===k;return <button key={k} onClick={()=>setFt(k)} style={{padding:"3px 10px",borderRadius:4,fontSize:11,fontWeight:500,border:`1px solid ${ac?(t?.color||"var(--blue)"):"var(--border)"}`,background:ac?(t?`${t.color}18`:"var(--blue-dim)"):"transparent",color:ac?(t?.color||"var(--blue)"):"var(--text2)",transition:"all 0.15s"}}>{k==="all"?"Todos":t.label}</button>;})}
        </div>
        <button className="btn-primary" onClick={()=>setAdd(true)}><Icon name="plus" size={14} color="#fff"/>Agregar</button>
      </div>
      {prox.length>0&&<><p className="section-title">Próximos ({prox.length})</p><div style={{display:"flex",flexDirection:"column",gap:6}}>{prox.map(ev=><Row key={ev.id} ev={ev}/>)}</div></>}
      {pas.length>0&&<><p className="section-title" style={{marginTop:8}}>Pasados ({pas.length})</p><div style={{display:"flex",flexDirection:"column",gap:6}}>{pas.map(ev=><Row key={ev.id} ev={ev}/>)}</div></>}
      {fil.length===0&&<div className="card" style={{padding:24,textAlign:"center",color:"var(--text2)",fontSize:13}}>Sin eventos</div>}
      {add&&<Modal title="Nuevo Evento" onClose={()=>setAdd(false)}><FormEvento materias={materias} onSave={f=>{onAdd(f);setAdd(false);}} onClose={()=>setAdd(false)}/></Modal>}
      {edit&&<Modal title="Editar Evento" onClose={()=>setEdit(null)}><FormEvento materias={materias} initial={edit} onSave={f=>{onEdit(edit.id,f);setEdit(null);}} onClose={()=>setEdit(null)}/></Modal>}
      {confirm&&<ConfirmModal nombre={confirm.nombre} onClose={()=>setConfirm(null)} onConfirm={()=>{onDelete(confirm.id);setConfirm(null);}}/>}
    </div>
  );
}

// ─── ARCHIVOS ─────────────────────────────────────────────────────────────────
function VistaArchivos({materias,userId,showToast}){
  const [archivos,setArchivos]=useState([]);
  const [loading,setLoading]=useState(true);
  const [fm,setFm]=useState("all");
  const [drag,setDrag]=useState(false);
  const [uploading,setUploading]=useState(false);
  const [confirm,setConfirm]=useState(null);

  useEffect(()=>{cargar();},[]);

  const cargar=async()=>{
    setLoading(true);
    const {data,error}=await sb.from("archivos").select("*").order("created_at",{ascending:false});
    if(error) showToast(error.message);
    setArchivos(data||[]);
    setLoading(false);
  };

  const subir=async(files)=>{
    setUploading(true);
    for(const file of Array.from(files)){
      const path=`${userId}/${Date.now()}_${file.name}`;
      const {error:upErr}=await sb.storage.from("archivos").upload(path,file);
      if(upErr){showToast(upErr.message);continue;}
      const matId=fm==="all"?(materias[0]?.id||null):fm;
      const {error:dbErr}=await sb.from("archivos").insert({user_id:userId,materia_id:matId,nombre:file.name,tipo:file.name.split(".").pop().toUpperCase(),tamaño:file.size,storage_path:path});
      if(dbErr) showToast(dbErr.message);
    }
    await cargar();
    setUploading(false);
  };

  const eliminar=async(a)=>{
    if(a.storage_path){const {error}=await sb.storage.from("archivos").remove([a.storage_path]);if(error)showToast(error.message);}
    const {error}=await sb.from("archivos").delete().eq("id",a.id);
    if(error){showToast(error.message);return;}
    setArchivos(prev=>prev.filter(x=>x.id!==a.id));
  };

  const descargar=async(a)=>{
    if(!a.storage_path) return;
    const {data,error}=await sb.storage.from("archivos").createSignedUrl(a.storage_path,60);
    if(error){showToast(error.message);return;}
    if(data?.signedUrl) window.open(data.signedUrl,"_blank");
  };

  const fil=fm==="all"?archivos:archivos.filter(a=>a.materia_id===fm);
  const fT=b=>b>1e6?`${(b/1e6).toFixed(1)} MB`:b>1e3?`${(b/1e3).toFixed(0)} KB`:`${b} B`;
  const tC=t=>({PDF:"var(--red)",DOCX:"var(--blue)",DOC:"var(--blue)",XLSX:"var(--green)",PPTX:"var(--slate)",PNG:"var(--slate)",JPG:"var(--slate)"})[t]||"var(--text2)";

  if(loading) return <Spinner/>;
  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",gap:13}}>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
        <select value={fm} onChange={e=>setFm(e.target.value)} style={{flex:1,minWidth:180}}>
          <option value="all">Todas las materias</option>
          {materias.map(m=><option key={m.id} value={m.id}>{m.nombre}</option>)}
        </select>
        <label className="btn-primary" style={{cursor:uploading?"wait":"pointer",opacity:uploading?0.6:1}}>
          <Icon name="upload" size={14} color="#fff"/>{uploading?"Subiendo...":"Subir"}
          <input type="file" multiple style={{display:"none"}} onChange={e=>subir(e.target.files)} disabled={uploading}/>
        </label>
      </div>
      <div onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)}
        onDrop={e=>{e.preventDefault();setDrag(false);subir(e.dataTransfer.files);}}
        style={{border:`1px dashed ${drag?"var(--blue)":"var(--border)"}`,borderRadius:10,padding:"20px",textAlign:"center",background:drag?"var(--blue-dim)":"var(--surface)",transition:"all 0.2s",color:"var(--text2)",fontSize:13}}>
        {drag?"Soltar archivos aquí":"O arrastrar archivos aquí"}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {fil.length===0?<div className="card" style={{padding:20,textAlign:"center",color:"var(--text2)",fontSize:13}}>Sin archivos{fm!=="all"?" para esta materia":""}</div>:fil.map(a=>{
          const mat=materias.find(m=>m.id===a.materia_id);
          return(
            <div key={a.id} className="card" style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:11}}>
              <span style={{fontFamily:"'DM Mono'",fontSize:10,fontWeight:600,color:tC(a.tipo),background:`${tC(a.tipo)}15`,padding:"3px 6px",borderRadius:4,flexShrink:0}}>{a.tipo}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.nombre}</div>
                <div style={{fontSize:11,color:"var(--text2)",display:"flex",gap:9,marginTop:2,flexWrap:"wrap"}}>
                  {mat&&<span>{mat.nombre}</span>}
                  {a.tamaño&&<span>{fT(a.tamaño)}</span>}
                  <span>{new Date(a.created_at).toLocaleDateString("es-AR")}</span>
                </div>
              </div>
              <div style={{display:"flex",gap:5}}>
                {a.storage_path&&<button className="btn-ghost" style={{padding:"5px 9px",fontSize:12}} onClick={()=>descargar(a)}>Descargar</button>}
                <button className="btn-danger" onClick={()=>setConfirm({archivo:a,nombre:a.nombre})}><Icon name="trash" size={13}/></button>
              </div>
            </div>
          );
        })}
      </div>
      {confirm&&<ConfirmModal nombre={confirm.nombre} onClose={()=>setConfirm(null)} onConfirm={()=>{eliminar(confirm.archivo);setConfirm(null);}}/>}
    </div>
  );
}

// ─── ASISTENTE IA ─────────────────────────────────────────────────────────────
function VistaAsistente({materias,eventos}){
  const [historial,setHistorial]=useState(()=>{
    try{return JSON.parse(localStorage.getItem("utn_historial")||"{}");}catch{return{};}
  });
  const [modelo,setModelo]=useState(()=>localStorage.getItem("utn_modelo")||"claude");
  const [materiaId,setMateriaId]=useState(materias.find(m=>["cursando","regular"].includes(m.estado))?.id||materias[0]?.id||null);
  const [modo,setModo]=useState(null);
  const [msgs,setMsgs]=useState([]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const bottomRef=useRef(null);
  const materia=materias.find(m=>m.id===materiaId);

  // Cambio de modelo → persiste en localStorage
  const cambiarModelo=(m)=>{setModelo(m);localStorage.setItem("utn_modelo",m);};

  // Cargar historial al cambiar materia/modo
  useEffect(()=>{
    if(materiaId&&modo){const k=`${materiaId}_${modo}`;setMsgs(historial[k]||[]);}
  },[materiaId,modo]);

  // Guardar historial al cambiar msgs (slice -20)
  useEffect(()=>{
    if(materiaId&&modo&&msgs.length>0){
      const k=`${materiaId}_${modo}`;
      const nuevo={...historial,[k]:msgs.slice(-20)};
      setHistorial(nuevo);
      localStorage.setItem("utn_historial",JSON.stringify(nuevo));
    }
  },[msgs]);

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[msgs,loading]);

  const mkSystem=(m)=>{
    const ev=eventos.filter(e=>e.materia_id===materiaId).map(e=>`${e.tipo}: ${e.titulo} el ${e.fecha}`).join(", ")||"ninguno";
    const base=`Sos un asistente de estudio universitario para la materia "${materia?.nombre}" de UTN Sistemas Argentina. Año ${materia?.año}, cuatrimestre ${materia?.cuatrimestre}. Estado: ${ESTADOS[materia?.estado]?.label}. Eventos: ${ev}. Respondé siempre en español argentino, claro y directo.`;
    return {
      tutor:`${base} Modo TUTOR: evaluá si el alumno entendió los temas. Hacé preguntas concretas de a una, esperá respuesta, evaluá. No des la respuesta antes. Empezá preguntando qué tema quiere repasar.`,
      planificar:`${base} Modo PLANIFICADOR: ayudá a organizar un plan de estudio. Preguntá cuántos días y horas disponibles tiene. Luego armá un plan día por día.`,
      tp:`${base} Modo TP: ayudá con trabajos prácticos guiando sin dar la solución directa. Empezá preguntando en qué consiste el TP.`,
      libre:`${base} Modo LIBRE: respondé cualquier consulta académica. Saludo breve y preguntá en qué ayudar.`,
    }[m]||base;
  };

  const callIA=async(systemPrompt,messages)=>{
    const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({system:systemPrompt,messages,modelo})});
    const data=await res.json();
    if(data.error) throw new Error(data.error);
    return data.text;
  };

  const iniciarModo=async(m)=>{
    setModo(m);
    const k=`${materiaId}_${m}`;
    if(historial[k]?.length>0){setMsgs(historial[k]);return;}
    setMsgs([]);setLoading(true);
    try{
      const txt=await callIA(mkSystem(m),[{role:"user",content:"Hola, empecemos."}]);
      setMsgs([{role:"assistant",content:txt}]);
    }catch(e){setMsgs([{role:"assistant",content:"Hola, estoy listo. ¿En qué te puedo ayudar?"}]);}
    setLoading(false);
  };

  const enviar=async()=>{
    if(!input.trim()||loading)return;
    const userMsg={role:"user",content:input.trim()};
    const newMsgs=[...msgs,userMsg];
    setMsgs(newMsgs);setInput("");setLoading(true);
    try{
      const txt=await callIA(mkSystem(modo),newMsgs.map(m=>({role:m.role,content:m.content})));
      setMsgs(m=>[...m,{role:"assistant",content:txt}]);
    }catch(e){setMsgs(m=>[...m,{role:"assistant",content:`Error: ${e.message}`}]);}
    setLoading(false);
  };

  const limpiar=()=>{
    setMsgs([]);
    if(materiaId&&modo){
      const k=`${materiaId}_${modo}`;
      const nuevo={...historial};delete nuevo[k];
      setHistorial(nuevo);
      localStorage.setItem("utn_historial",JSON.stringify(nuevo));
    }
  };

  const modeloInfo=MODELOS_IA.find(m=>m.id===modelo);

  if(!modo) return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",gap:20}}>
      {/* Selector de materia */}
      <div>
        <Lbl>Seleccioná una materia</Lbl>
        <select style={{width:"100%",maxWidth:420}} value={materiaId||""} onChange={e=>setMateriaId(e.target.value)}>
          {materias.map(m=><option key={m.id} value={m.id}>{m.nombre} ({ESTADOS[m.estado]?.label})</option>)}
        </select>
      </div>

      {materia&&<div className="card" style={{padding:"14px 16px",borderLeft:"3px solid var(--blue)"}}>
        <div style={{fontSize:14,fontWeight:600}}>{materia.nombre}</div>
        <div style={{fontSize:11,color:"var(--text2)",marginTop:2}}>Año {materia.año} · {materia.cuatrimestre}° cuat. · <span style={{color:ESTADOS[materia.estado]?.color}}>{ESTADOS[materia.estado]?.label}</span></div>
      </div>}

      {/* Motor de IA */}
      <div>
        <p className="section-title">Motor de IA</p>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {MODELOS_IA.map(m=>(
            <button key={m.id} onClick={()=>cambiarModelo(m.id)} style={{
              padding:"8px 16px",borderRadius:6,fontSize:13,fontWeight:600,
              border:`1px solid ${modelo===m.id?m.color:"var(--border)"}`,
              background:modelo===m.id?`${m.color}18`:"transparent",
              color:modelo===m.id?m.color:"var(--text2)",
              transition:"all 0.15s"
            }}>{m.label}</button>
          ))}
        </div>
        <div style={{fontSize:11,color:"var(--text3)",marginTop:8}}>
          Motor seleccionado: <span style={{color:modeloInfo?.color,fontWeight:600}}>{modeloInfo?.label}</span>
        </div>
      </div>

      {/* Modos */}
      <div>
        <p className="section-title">Elegí un modo</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
          {MODOS_IA.map(mo=>{
            const tiene=historial[`${materiaId}_${mo.id}`]?.length>0;
            return(
              <button key={mo.id} onClick={()=>iniciarModo(mo.id)} style={{background:"var(--surface)",border:`1px solid ${tiene?"var(--blue)":"var(--border)"}`,borderRadius:10,padding:"16px",textAlign:"left",transition:"all 0.15s",cursor:"pointer"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--blue)";e.currentTarget.style.background="var(--blue-dim)";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=tiene?"var(--blue)":"var(--border)";e.currentTarget.style.background="var(--surface)";}}>
                <div style={{fontFamily:"'Barlow Condensed'",fontSize:15,fontWeight:700,color:"var(--text)",marginBottom:5}}>{mo.label}</div>
                <div style={{fontSize:12,color:"var(--text2)",lineHeight:1.5}}>{mo.desc}</div>
                {tiene&&<div style={{fontSize:10,color:"var(--blue)",marginTop:8,fontWeight:500}}>Sesión guardada · Continuar</div>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  const modoInfo=MODOS_IA.find(m=>m.id===modo);
  const userMsgs=msgs.filter(m=>m.role==="user").length;
  const totalMsgs=msgs.length;

  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",height:"calc(100vh - 130px)",minHeight:400}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,flexWrap:"wrap"}}>
        <button className="btn-ghost" style={{padding:"6px 11px",fontSize:12}} onClick={()=>setModo(null)}><Icon name="chevronL" size={13}/>Volver</button>
        <div style={{flex:1,minWidth:0,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <span style={{fontSize:13,fontWeight:600}}>{materia?.nombre}</span>
          <span className="tag" style={{background:"var(--blue-dim)",color:"var(--blue)"}}>{modoInfo?.label}</span>
          <span className="tag" style={{background:`${modeloInfo?.color}18`,color:modeloInfo?.color,fontSize:10}}>{modeloInfo?.label}</span>
        </div>
        <button className="btn-ghost" style={{padding:"6px 10px"}} onClick={limpiar} title="Limpiar conversación"><Icon name="refresh" size={13}/></button>
      </div>

      {/* Mensajes */}
      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:10,paddingRight:4}}>
        {msgs.length===0&&!loading&&<div style={{textAlign:"center",color:"var(--text2)",fontSize:13,padding:"40px 20px"}}>Iniciando sesión...</div>}
        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
            <div style={{maxWidth:"80%",padding:"10px 14px",borderRadius:10,fontSize:13,lineHeight:1.6,background:m.role==="user"?"var(--blue)":"var(--surface2)",color:m.role==="user"?"#fff":"var(--text)",borderBottomRightRadius:m.role==="user"?2:10,borderBottomLeftRadius:m.role==="assistant"?2:10,border:m.role==="assistant"?"1px solid var(--border)":"none",whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{m.content}</div>
          </div>
        ))}
        {loading&&<div style={{display:"flex",justifyContent:"flex-start"}}><div style={{padding:"10px 16px",borderRadius:10,background:"var(--surface2)",border:"1px solid var(--border)",display:"flex",gap:5,alignItems:"center"}}>{[0,1,2].map(i=><span key={i} className="pulse" style={{width:7,height:7,borderRadius:"50%",background:"var(--blue)",display:"inline-block",animationDelay:`${i*0.2}s`}}/>)}</div></div>}
        <div ref={bottomRef}/>
      </div>

      {/* Contador de mensajes */}
      <div style={{textAlign:"center",fontSize:11,color:"var(--text3)",padding:"6px 0 4px"}}>
        {totalMsgs} {totalMsgs===1?"mensaje":"mensajes"} en esta sesión
      </div>

      {/* Input */}
      <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
        <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();enviar();}}} placeholder="Escribí tu mensaje... (Enter para enviar)" rows={2} style={{flex:1,resize:"none",borderRadius:8,lineHeight:1.5,fontSize:13,padding:"10px 12px"}}/>
        <button className="btn-primary" onClick={enviar} disabled={loading||!input.trim()} style={{padding:"10px 14px",opacity:loading||!input.trim()?0.5:1}}><Icon name="send" size={15} color="#fff"/></button>
      </div>
    </div>
  );
}

// ─── NAV ──────────────────────────────────────────────────────────────────────
const NAV=[
  {id:"dashboard",label:"Dashboard",icon:"dashboard"},
  {id:"materias", label:"Materias", icon:"materias" },
  {id:"horarios", label:"Horarios", icon:"horarios" },
  {id:"eventos",  label:"Eventos",  icon:"eventos"  },
  {id:"archivos", label:"Archivos", icon:"archivos" },
  {id:"asistente",label:"IA",       icon:"asistente"},
];
const TITULOS={dashboard:"Dashboard",materias:"Mis Materias",horarios:"Horario Semanal",eventos:"Eventos y Fechas",archivos:"Archivos",asistente:"Asistente IA"};

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App(){
  const isMobile=useIsMobile();
  const [session,setSession]=useState(undefined);
  const [vista,setVista]=useState("dashboard");
  const [sideOpen,setSideOpen]=useState(!isMobile);
  const [materias,setMaterias]=useState([]);
  const [eventos,setEventos]=useState([]);
  const [loadingData,setLoadingData]=useState(true);
  const {toasts,show:showToast}=useToast();
  const [showNotifs,setShowNotifs]=useState(false);
  const [iaActiva,setIaActiva]=useState(false); // se carga desde el perfil del usuario

  // Sincronizar sideOpen con isMobile al cambiar tamaño
  useEffect(()=>{setSideOpen(!isMobile);},[isMobile]);

  useEffect(()=>{
    sb.auth.getSession().then(({data:{session}})=>setSession(session));
    const {data:{subscription}}=sb.auth.onAuthStateChange((_,s)=>setSession(s));
    return()=>subscription.unsubscribe();
  },[]);

  useEffect(()=>{
    if(session) cargarTodo();
    else{setMaterias([]);setEventos([]);setLoadingData(false);}
  },[session]);

  const cargarTodo=async()=>{
    setLoadingData(true);
    const [{data:m,error:em},{data:e,error:ee}]=await Promise.all([
      sb.from("materias").select("*").order("año").order("cuatrimestre"),
      sb.from("eventos").select("*").order("fecha"),
    ]);
    if(em) showToast(em.message);
    if(ee) showToast(ee.message);
    setMaterias(m||[]);
    setEventos(e||[]);
    // Cargar preferencias del usuario (ia_activa)
    const {data:perfil}=await sb.from("perfiles").select("ia_activa").eq("id",session.user.id).single();
    if(perfil) setIaActiva(!!perfil.ia_activa);
    setLoadingData(false);
  };

  // PWA
  useEffect(()=>{
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="80" fill="#0b0e13"/><text x="256" y="230" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="130" fill="#4a90d9">UTN</text><text x="256" y="330" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="60" fill="#7d8899">TRACKER</text></svg>`;
    const url=URL.createObjectURL(new Blob([svg],{type:"image/svg+xml"}));
    let lk=document.querySelector("link[rel='icon']");
    if(!lk){lk=document.createElement("link");lk.rel="icon";document.head.appendChild(lk);}
    lk.type="image/svg+xml";lk.href=url;
    document.title="UTN Tracker";
    let meta=document.querySelector("meta[name='theme-color']");
    if(!meta){meta=document.createElement("meta");meta.name="theme-color";document.head.appendChild(meta);}
    meta.content="#0b0e13";
    return()=>URL.revokeObjectURL(url);
  },[]);

  // CRUD con toast en errores
  const addMateria=async(f)=>{
    const {data,error}=await sb.from("materias").insert({...f,user_id:session.user.id,nota:f.nota||null}).select().single();
    if(error){showToast(error.message);return;}
    setMaterias(m=>[...m,data]);
  };
  const editMateria=async(id,f)=>{
    const {data,error}=await sb.from("materias").update({...f,nota:f.nota||null}).eq("id",id).select().single();
    if(error){showToast(error.message);return;}
    setMaterias(m=>m.map(x=>x.id===id?data:x));
  };
  const delMateria=async(id)=>{
    const {error}=await sb.from("materias").delete().eq("id",id);
    if(error){showToast(error.message);return;}
    setMaterias(m=>m.filter(x=>x.id!==id));
  };
  const addEvento=async(f)=>{
    const {data,error}=await sb.from("eventos").insert({...f,user_id:session.user.id}).select().single();
    if(error){showToast(error.message);return;}
    setEventos(e=>[...e,data]);
  };
  const editEvento=async(id,f)=>{
    const {data,error}=await sb.from("eventos").update(f).eq("id",id).select().single();
    if(error){showToast(error.message);return;}
    setEventos(e=>e.map(x=>x.id===id?data:x));
  };
  const delEvento=async(id)=>{
    const {error}=await sb.from("eventos").delete().eq("id",id);
    if(error){showToast(error.message);return;}
    setEventos(e=>e.filter(x=>x.id!==id));
  };

  if(session===undefined) return <div style={{minHeight:"100vh",background:"#0b0e13",display:"flex",alignItems:"center",justifyContent:"center"}}><style>{G}</style><Spinner/></div>;
  if(!session) return <AuthPage onAuth={()=>sb.auth.getSession().then(({data:{session}})=>setSession(session))}/>;

  return(
    <>
      <style>{G}</style>
      <div style={{display:"flex",minHeight:"100vh"}}>

        {/* SIDEBAR */}
        <aside className="sidebar" style={{width:sideOpen?216:56,flexShrink:0,background:"var(--surface)",borderRight:"1px solid var(--border)",flexDirection:"column",transition:"width 0.22s ease",overflow:"hidden",position:"sticky",top:0,height:"100vh"}}>
          <div style={{padding:"17px 13px",display:"flex",alignItems:"center",gap:9,borderBottom:"1px solid var(--border)",minHeight:60}}>
            <div style={{width:28,height:28,background:"var(--blue)",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Barlow Condensed'",fontWeight:800,color:"#fff",fontSize:14,flexShrink:0}}>U</div>
            {sideOpen&&<div><div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:15,letterSpacing:0.5,lineHeight:1}}>UTN TRACKER</div><div style={{fontSize:9,color:"var(--text3)",letterSpacing:1.5,marginTop:2}}>SISTEMAS · TUC</div></div>}
          </div>
          <nav style={{padding:"9px 6px",flex:1}}>
            {NAV.map(n=>{const ac=vista===n.id;return(
              <button key={n.id} onClick={()=>setVista(n.id)} style={{display:"flex",alignItems:"center",gap:9,width:"100%",padding:"9px 10px",borderRadius:6,border:"none",marginBottom:1,background:ac?"var(--blue-dim)":"transparent",color:ac?"var(--blue)":"var(--text2)",fontSize:13,fontWeight:ac?600:400,transition:"all 0.12s",textAlign:"left"}}
                onMouseEnter={e=>{if(!ac){e.currentTarget.style.background="var(--surface2)";e.currentTarget.style.color="var(--text)";}}}
                onMouseLeave={e=>{if(!ac){e.currentTarget.style.background="transparent";e.currentTarget.style.color="var(--text2)";}}} >
                <span style={{flexShrink:0,opacity:ac?1:0.7}}><Icon name={n.icon} size={16} color={ac?"var(--blue)":"currentColor"}/></span>
                {sideOpen&&<span>{n.label}</span>}
                {sideOpen&&ac&&<span style={{marginLeft:"auto",width:3,height:3,borderRadius:"50%",background:"var(--blue)"}}/>}
              </button>
            );})}
          </nav>
          {sideOpen&&session&&<div style={{padding:"10px 14px",borderTop:"1px solid var(--border)"}}>
            <div style={{fontSize:11,color:"var(--text2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:6}}>{session.user.email}</div>
            <button className="btn-ghost" style={{width:"100%",justifyContent:"center",fontSize:12,padding:"6px"}} onClick={()=>sb.auth.signOut()}><Icon name="logout" size={13}/>Cerrar sesión</button>
          </div>}
          <button onClick={()=>setSideOpen(o=>!o)} style={{margin:"9px 6px",padding:"9px",border:"1px solid var(--border)",borderRadius:6,background:"transparent",color:"var(--text2)",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--blue)";e.currentTarget.style.color="var(--blue)";}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--text2)";}}>
            <Icon name={sideOpen?"chevronL":"chevronR"} size={14}/>
          </button>
        </aside>

        {/* MAIN */}
        <main style={{flex:1,minWidth:0,display:"flex",flexDirection:"column"}}>
          <header className="header-pad" style={{borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:12,background:"var(--surface)",position:"sticky",top:0,zIndex:10}}>
            <div style={{flex:1}}>
              <h1 style={{fontFamily:"'Barlow Condensed'",fontSize:20,fontWeight:800,letterSpacing:0.3}}>{TITULOS[vista]}</h1>
              <div style={{fontSize:10,color:"var(--text3)",fontFamily:"'DM Mono'",marginTop:1}}>{new Date().toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>
            </div>
            <span className="tag" style={{background:"var(--blue-dim)",color:"var(--blue)",fontSize:10,display:"flex",alignItems:"center",gap:4}}>
              <Icon name="signal" size={11} color="var(--blue)"/>En línea
            </span>
            <button onClick={()=>setShowNotifs(true)} style={{
              position:"relative",background:"var(--surface2)",border:"1px solid var(--border)",
              borderRadius:7,padding:"7px 9px",display:"flex",alignItems:"center",cursor:"pointer",
              transition:"border-color 0.15s",color:"var(--text2)"
            }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--blue)";e.currentTarget.style.color="var(--blue)";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--text2)";}}>
              <Icon name="bell" size={16}/>
            </button>
          </header>
          <div className="main-pad" style={{flex:1}}>
            {loadingData?<Spinner/>:<>
              {vista==="dashboard" &&<Dashboard  materias={materias} eventos={eventos}/>}
              {vista==="materias"  &&<VistasMaterias materias={materias} onAdd={addMateria} onEdit={editMateria} onDelete={delMateria}/>}
              {vista==="horarios"  &&<VistaHorarios materias={materias}/>}
              {vista==="eventos"   &&<VistaEventos  materias={materias} eventos={eventos} onAdd={addEvento} onEdit={editEvento} onDelete={delEvento}/>}
              {vista==="archivos"  &&<VistaArchivos materias={materias} userId={session.user.id} showToast={showToast}/>}
              {vista==="asistente" &&(iaActiva?<VistaAsistente materias={materias} eventos={eventos}/>:<BloqueadoIA/>)}
            </>}
          </div>
        </main>
      </div>

      {/* BOTTOM NAV mobile */}
      <nav className="bottom-nav" style={{position:"fixed",bottom:0,left:0,right:0,height:"var(--nav-h)",background:"var(--surface)",borderTop:"1px solid var(--border)",alignItems:"center",justifyContent:"space-around",zIndex:50,paddingBottom:"env(safe-area-inset-bottom)"}}>
        {NAV.map(n=>{const ac=vista===n.id;return(
          <button key={n.id} onClick={()=>setVista(n.id)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,background:"none",border:"none",color:ac?"var(--blue)":"var(--text3)",padding:"6px 8px",borderRadius:8,transition:"color 0.15s",minWidth:44}}>
            <Icon name={n.icon} size={20} color={ac?"var(--blue)":"currentColor"}/>
            <span style={{fontSize:9,fontWeight:ac?700:400,letterSpacing:0.3}}>{n.label}</span>
          </button>
        );})}
      </nav>

      {/* TOASTS */}
      <ToastContainer toasts={toasts}/>
      {/* PANEL NOTIFICACIONES */}
      {showNotifs&&<PanelNotificaciones materias={materias} eventos={eventos} onClose={()=>setShowNotifs(false)}/>}
    </>
  );
}
