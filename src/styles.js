// ─── ESTILOS GLOBALES ────────────────────────────────────────────────────────
export const G = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Barlow+Condensed:wght@400;600;700;800&family=Barlow:wght@300;400;500;600&display=swap');
  :root {
    --bg:#0b0e13; --surface:#111418; --surface2:#181c23; --surface3:#1f242d;
    --border:#252b36; --border2:#2f3748;
    /* Contraste AA: text2 ~6:1, text3 ~4.7:1 sobre el fondo (antes #4a5568 fallaba a 2.3:1) */
    --text:#e3e8f1; --text2:#97a1b2; --text3:#79839a;
    --blue:#4a90d9; --blue2:#3a7bc8; --blue-dim:rgba(74,144,217,0.1); --blue-mid:rgba(74,144,217,0.2);
    --green:#5aad8f; --red:#c0504d; --slate:#7a8fa8;
    --radius:7px; --radius2:10px; --nav-h:58px;
  }
  *{box-sizing:border-box;margin:0;padding:0;}
  html,body{height:100%;}
  body{background:var(--bg);color:var(--text);font-family:'Barlow',sans-serif;min-height:100vh;line-height:1.5;-webkit-font-smoothing:antialiased;}
  ::-webkit-scrollbar{width:5px;height:5px;}
  ::-webkit-scrollbar-track{background:var(--surface);}
  ::-webkit-scrollbar-thumb{background:var(--border2);border-radius:3px;}
  input,select,textarea{background:var(--surface2);border:1px solid var(--border);color:var(--text);padding:8px 12px;border-radius:var(--radius);font-family:'Barlow',sans-serif;font-size:14px;outline:none;transition:border-color 0.2s;}
  input:focus,select:focus,textarea:focus{border-color:var(--blue);}
  option{background:var(--surface2);}
  button{cursor:pointer;font-family:'Barlow',sans-serif;}
  /* Foco visible para navegación por teclado (accesibilidad) */
  button:focus-visible,a:focus-visible,[role="button"]:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid var(--blue);outline-offset:2px;}
  .mono{font-family:'DM Mono',monospace;}
  .tag{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:4px;font-size:12px;font-weight:500;letter-spacing:0.3px;white-space:nowrap;}
  .card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius2);}
  .btn-primary{background:var(--blue);color:#fff;border:none;padding:9px 18px;min-height:38px;border-radius:var(--radius);font-size:13px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;gap:6px;transition:background 0.2s;}
  .btn-primary:hover{background:var(--blue2);}
  .btn-ghost{background:transparent;color:var(--text2);border:1px solid var(--border);padding:8px 14px;min-height:38px;border-radius:var(--radius);font-size:13px;display:inline-flex;align-items:center;justify-content:center;gap:6px;transition:all 0.2s;}
  .btn-ghost:hover{border-color:var(--blue);color:var(--blue);}
  .btn-danger{background:transparent;color:var(--red);border:1px solid rgba(192,80,77,0.25);padding:8px 12px;min-height:36px;border-radius:var(--radius);font-size:13px;display:inline-flex;align-items:center;justify-content:center;transition:all 0.2s;}
  .btn-danger:hover{background:rgba(192,80,77,0.1);}
  .section-title{font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--text3);margin-bottom:12px;}
  .field-error{font-size:12px;color:var(--red);margin-top:4px;}
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
    /* 16px evita que iOS haga zoom al enfocar un campo; targets más grandes para el dedo */
    input,select,textarea{font-size:16px;}
    .btn-primary,.btn-ghost,.btn-danger{min-height:44px;}
  }
  /* Respeta a quien pide menos movimiento (accesibilidad) */
  @media(prefers-reduced-motion:reduce){
    *,::before,::after{animation-duration:0.01ms !important;animation-iteration-count:1 !important;transition-duration:0.01ms !important;scroll-behavior:auto !important;}
  }
`;
