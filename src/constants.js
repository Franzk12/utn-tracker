// ─── CONSTANTES ──────────────────────────────────────────────────────────────
export const MAIN_USER_ID = import.meta.env.VITE_MAIN_USER_ID || null;

export const ESTADOS = {
  cursando: { label: "Cursando", color: "#60a5fa", bg: "rgba(96,165,250,0.1)" },
  regular: { label: "Regular", color: "#94a3b8", bg: "rgba(148,163,184,0.1)" },
  promocionada: { label: "Promocionada", color: "#6ee7b7", bg: "rgba(110,231,183,0.1)" },
  aprobada_final: { label: "Aprobada c/Final", color: "#6ee7b7", bg: "rgba(110,231,183,0.1)" },
  libre: { label: "Libre", color: "#f87171", bg: "rgba(248,113,113,0.1)" },
  pendiente: { label: "Pendiente", color: "#475569", bg: "rgba(71,85,105,0.15)" },
};
export const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
export const HORAS = ["12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00", "22:30", "23:00"];
export const TIPO_EVENTO = {
  parcial: { label: "Parcial", color: "#60a5fa" },
  final: { label: "Final", color: "#f87171" },
  tp: { label: "TP", color: "#6ee7b7" },
  otro: { label: "Otro", color: "#94a3b8" },
};
export const MODOS_IA = [
  { id: "tutor", label: "Tutor", desc: "Te evalúa con preguntas para ver si entendiste el tema" },
  { id: "planificar", label: "Planificar", desc: "Te arma un plan de estudio en base a tus días disponibles" },
  { id: "tp", label: "TP / Código", desc: "Te guía en trabajos prácticos sin darte la respuesta" },
  { id: "libre", label: "Chat libre", desc: "Hacé cualquier consulta académica sin estructura" },
];
export const MODELOS_IA = [
  { id: "claude", label: "Claude Sonnet", color: "#c96442" },
  { id: "gpt", label: "GPT-4o mini", color: "#10a37f" },
  { id: "gemini", label: "Gemini Flash", color: "#4285f4" },
];

// ─── PLAN DE ESTUDIO (UTN SISTEMAS - FRT - PLAN 2023) ────────────────────────
export const PLAN_ESTUDIO = [
  {
    año: 0,
    materias: [
      { id: "fis0", nombre: "Física", c: 0 },
      { id: "mat0", nombre: "Matemática", c: 0 },
      { id: "tou", nombre: "Taller de Orientación Universitaria", c: 0 },
    ]
  },
  {
    año: 1,
    materias: [
      { id: "aed", nombre: "Algoritmos y Estructuras de Datos", c: 0 },
      { id: "am1", nombre: "Análisis Matemático I", c: 0 },
      { id: "arc", nombre: "Arquitectura de Computadoras", c: 0 },
      { id: "f1", nombre: "Física I", c: 0 },
      { id: "iys", nombre: "Ingeniería y Sociedad", c: 0 },
      { id: "led", nombre: "Lógica y Estructuras Discretas", c: 0 },
      { id: "spn", nombre: "Sistemas y Procesos de Negocio", c: 0 },
      { id: "aga", nombre: "Álgebra y Geometría Analítica", c: 0 },
    ]
  },
  {
    año: 2,
    materias: [
      { id: "asi", nombre: "Análisis de Sistemas de Información", c: 0 },
      { id: "am2", nombre: "Análisis Matemático II", c: 0 },
      { id: "f2", nombre: "Física II", c: 0 },
      { id: "i1", nombre: "Inglés I", c: 0 },
      { id: "pdp", nombre: "Paradigmas de Programación", c: 0 },
      { id: "ssl", nombre: "Sintaxis y Semántica de los Lenguajes", c: 0 },
      { id: "so", nombre: "Sistemas Operativos", c: 0 },
    ]
  },
  {
    año: 3,
    materias: [
      { id: "an", nombre: "Análisis Numérico", c: 0 },
      { id: "bd", nombre: "Bases de Datos", c: 0 },
      { id: "cd", nombre: "Comunicación de Datos", c: 0 },
      { id: "ds", nombre: "Desarrollo de Software", c: 0 },
      { id: "dsi", nombre: "Diseño de Sistemas de Información", c: 0 },
      { id: "eco", nombre: "Economía", c: 0 },
      { id: "i2", nombre: "Inglés II", c: 0 },
      { id: "pye", nombre: "Probabilidad y Estadística", c: 0 },
    ]
  },
  {
    año: 4,
    materias: [
      { id: "asi2", nombre: "Administración de Sistemas de Información", c: 0 },
      { id: "ics", nombre: "Ingeniería y Calidad de Software", c: 0 },
      { id: "io", nombre: "Investigación Operativa", c: 0 },
      { id: "leg", nombre: "Legislación", c: 0 },
      { id: "rd", nombre: "Redes de Datos", c: 0 },
      { id: "sim", nombre: "Simulación", c: 0 },
      { id: "tpa", nombre: "Tecnologías para la Automatización", c: 0 },
    ]
  },
  {
    año: 5,
    materias: [
      { id: "cd2", nombre: "Ciencia de Datos", c: 0 },
      { id: "gg", nombre: "Gestión Gerencial", c: 0 },
      { id: "iai", nombre: "Inteligencia Artificial", c: 0 },
      { id: "pfe", nombre: "Proyecto Final", c: 0 },
      { id: "pps", nombre: "Práctica Profesional Supervisada", c: 0 },
      { id: "ssi", nombre: "Seguridad en los Sistemas de Información", c: 0 },
      { id: "sis", nombre: "Sistemas de Gestión", c: 0 },
    ]
  }
];

export const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  { id: "materias", label: "Materias", icon: "materias" },
  { id: "horarios", label: "Horarios", icon: "horarios" },
  { id: "eventos", label: "Agenda", icon: "eventos" },
  { id: "enfoque", label: "Enfoque", icon: "horarios" },
  { id: "archivos", label: "Archivos", icon: "archivos" },
  { id: "asistente", label: "IA", icon: "asistente" },
  { id: "perfil", label: "Perfil", icon: "materias" },
];
export const TITULOS = { dashboard: "Dashboard", materias: "Mis Materias", horarios: "Horario Semanal", eventos: "Agenda Académica", enfoque: "Modo Enfoque", archivos: "Archivos", asistente: "Asistente IA", perfil: "Mi Perfil" };
