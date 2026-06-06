// MedAlert.js
const API = 'https://medalertserv.onrender.com';

// ─── Estado global ────────────────────────────────────────────────
const state = {
  usuario:  null,
  token:    null,
  rol:      null,           // 'admin' | 'medico' | 'paciente' | 'familiar'
  id_paciente: null,        // id del paciente asociado (paciente/familiar)
  pacientes: [],            // caché para médico/admin
};

// ─── Permisos por rol ─────────────────────────────────────────────
const PERMISOS = {
  admin:    ['mainmenu','horarios','nuevo-horario','pacientes','nuevo-paciente','medicamentos','nuevo-medicamento','historial','cuenta'],
  medico:   ['mainmenu','horarios','nuevo-horario','pacientes','nuevo-paciente','medicamentos','nuevo-medicamento','historial','cuenta'],
  paciente: ['mainmenu','horarios','nuevo-horario','historial','cuenta'],
  familiar: ['mainmenu','horarios','nuevo-horario','historial','cuenta'],
};

function puedeVer(viewId) {
  if (!state.rol) return ['mainmenu','cuenta'].includes(viewId);
  return (PERMISOS[state.rol] ?? []).includes(viewId);
}

// ─── Navegación ───────────────────────────────────────────────────
let _prevView = 'mainmenu';

function nav(viewId) {
  if (!puedeVer(viewId)) {
    mostrarToast('Sin permisos para acceder a esta sección', 'error');
    return;
  }
  const current = document.querySelector('.view.active');
  if (current) { _prevView = current.id; current.classList.remove('active'); }

  const next = document.getElementById(viewId);
  if (next) next.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewId);
  });

  // Cargar datos al entrar
  const loaders = {
    mainmenu:          cargarInicio,
    horarios:          cargarHorarios,
    pacientes:         cargarPacientes,
    medicamentos:      cargarMedicamentos,
    historial:         cargarHistorial,
    'nuevo-horario':   prepararFormHorario,
    'nuevo-paciente':  () => {},
    'nuevo-medicamento': () => {},
  };
  loaders[viewId]?.();
}

function navBack() { nav(_prevView || 'mainmenu'); }

// ─── Aplicar rol al DOM ───────────────────────────────────────────
function aplicarRol(rol) {
  // Limpiar clases anteriores
  document.body.classList.remove('rol-admin','rol-medico','rol-paciente','rol-familiar');
  if (rol) document.body.classList.add(`rol-${rol}`);
  // sin-sesion se maneja en actualizarPanelInicio

  // Badge en toolbar
  const badge = document.getElementById('toolbar-rol');
  badge.className  = `rol-badge ${rol ? `rol-${rol} visible` : ''}`;
  badge.textContent = rol ?? '';

  // Selector de paciente en historial — visible para médico/admin/familiar
  const selectorHist = document.getElementById('selector-paciente-hist');
  selectorHist.style.display = ['medico','admin','familiar'].includes(rol) ? 'flex' : 'none';
}

// ─── INICIO ───────────────────────────────────────────────────────
function cargarInicio() {
  const h = new Date().getHours();
  document.getElementById('greeting').textContent =
    h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  document.getElementById('nombre-usuario').textContent = state.usuario?.nombre ?? 'Panel';

  if (!state.token) return;

  const esMedico = ['medico','admin'].includes(state.rol);
  if (esMedico) {
    cargarDashboardMedico();
  } else if (state.id_paciente) {
    cargarTomasHoy();
  }
}

async function cargarDashboardMedico() {
  const ul = document.getElementById('dashboard-pacientes');
  ul.innerHTML = '<li class="empty-state">Cargando…</li>';
  try {
    const res = await apiFetch('/api/pacientes');
    state.pacientes = res.pacientes ?? [];
    if (!state.pacientes.length) {
      ul.innerHTML = '<li class="empty-state">Sin pacientes registrados.</li>';
      return;
    }
    ul.innerHTML = state.pacientes.map(p => `
      <li>
        <div class="paciente-card" onclick="verHistorialPaciente(${p.id}, '${p.nombre}')">
          <div class="paciente-avatar">${p.nombre.charAt(0).toUpperCase()}</div>
          <div class="paciente-info">
            <p class="paciente-nombre">${p.nombre}</p>
            <p class="paciente-meta">${p.diagnostico ?? '—'} · ${p.dispositivo_id ?? 'sin dispositivo'}</p>
          </div>
          <svg class="paciente-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
          </svg>
        </div>
      </li>
    `).join('');
  } catch (e) {
    ul.innerHTML = '<li class="empty-state">Error al cargar pacientes.</li>';
  }
}

function verHistorialPaciente(idPaciente, nombre) {
  state.id_paciente = idPaciente;
  // Pre-seleccionar en el selector del historial
  const sel = document.getElementById('hist-paciente');
  if (sel) sel.value = idPaciente;
  nav('historial');
}

// ─── TOMAS HOY (paciente/familiar) ───────────────────────────────
async function cargarTomasHoy() {
  const hoy = hoyISO();
  try {
    const res   = await apiFetch(`/api/pacientes/${state.id_paciente}/historial?desde=${hoy}&hasta=${hoy}&pagina=1&por_pagina=30`);
    const tomas = res.tomas ?? [];
    renderTomasHoy(tomas);
    actualizarCards(tomas);
  } catch (_) {}
}

function renderTomasHoy(tomas) {
  const ul = document.getElementById('tomas-hoy');
  if (!tomas.length) {
    ul.innerHTML = '<li class="empty-state">Sin tomas programadas para hoy.</li>';
    return;
  }
  ul.innerHTML = tomas.map(t => `
    <li class="toma-item">
      <div class="toma-icon ${t.estado}">${iconoEstado(t.estado)}</div>
      <div class="toma-info">
        <p class="toma-nombre">${t.medicamento}</p>
        <p class="toma-meta">${formatHora(t.fecha_programada)}</p>
      </div>
      ${t.estado === 'pendiente' && state.rol !== 'paciente' || t.estado === 'pendiente'
        ? `<button class="btn-confirmar" onclick="confirmarToma(${t.id})" type="button">Confirmar</button>`
        : `<span class="toma-estado estado-${t.estado}">${t.estado}</span>`
      }
    </li>
  `).join('');
}

async function confirmarToma(idToma) {
  try {
    await apiFetch(`/api/tomas/${idToma}/confirm`, 'POST', { metodo: 'app' });
    mostrarToast('Toma confirmada ✓', 'ok');
    cargarTomasHoy();
  } catch (e) {
    mostrarToast(e.message ?? 'Error al confirmar', 'error');
  }
}

function actualizarCards(tomas) {
  const pend = tomas.find(t => t.estado === 'pendiente');
  const tom  = [...tomas].reverse().find(t => t.estado === 'tomado');
  document.getElementById('prox-med').textContent   = pend?.medicamento ?? 'Sin pendientes';
  document.getElementById('prox-hora').textContent  = pend ? formatHora(pend.fecha_programada) : '—';
  document.getElementById('prox-fecha').textContent = pend ? formatFecha(pend.fecha_programada) : '—';
  document.getElementById('ult-med').textContent    = tom?.medicamento ?? '—';
  document.getElementById('ult-hora').textContent   = tom ? formatHora(tom.fecha_confirmada ?? tom.fecha_programada) : '—';
  document.getElementById('ult-fecha').textContent  = tom ? formatFecha(tom.fecha_confirmada ?? tom.fecha_programada) : '—';
  // Stats
  const sp = document.getElementById('stat-pendientes');
  const st = document.getElementById('stat-tomadas');
  const so = document.getElementById('stat-omitidas');
  if (sp) sp.textContent = tomas.filter(t => t.estado === 'pendiente').length;
  if (st) st.textContent = tomas.filter(t => t.estado === 'tomado').length;
  if (so) so.textContent = tomas.filter(t => t.estado === 'omitido').length;
}

// ─── HORARIOS ────────────────────────────────────────────────────
async function cargarHorarios() {
  const idP = state.id_paciente;
  if (!state.token || !idP) {
    document.getElementById('horarios-list').innerHTML =
      '<li class="empty-state">Inicia sesión para ver los horarios.</li>';
    return;
  }
  try {
    const res = await apiFetch(`/api/horarios/${idP}`);
    renderHorarios(res.horarios ?? []);
  } catch (_) {}
}

function renderHorarios(horarios) {
  const ul = document.getElementById('horarios-list');
  if (!horarios.length) {
    ul.innerHTML = '<li class="empty-state">Sin horarios programados.</li>';
    return;
  }
  ul.innerHTML = horarios.map(h => {
    const esIndividual = h.una_sola_vez || h.fecha_especifica;
    const subtitulo = esIndividual
      ? (h.fecha_especifica ? formatFecha(h.fecha_especifica) : 'individual')
      : diasLabel(h.dias);
    const tipo = esIndividual
      ? '<span class="badge-tipo individual">individual</span>'
      : '<span class="badge-tipo rutina">rutina</span>';
    return `
    <li class="horario-item ${h.activo ? '' : 'horario-inactive'}">
      <div class="horario-comp">${h.compartimento}</div>
      <div class="horario-info">
        <p class="horario-nombre">${h.medicamento} ${h.dosis_mg}mg ${tipo}</p>
        <p class="horario-meta">${subtitulo} · ${h.activo ? 'activo' : 'inactivo'}</p>
      </div>
      <span class="horario-hora">${h.hora.substring(0,5)}</span>
    </li>`;
  }).join('');
}


// ─── TIPO DE HORARIO (rutina / individual) ────────────────────────
let _tipoHorario = 'rutina';

function setTipo(tipo) {
  _tipoHorario = tipo;
  document.getElementById('tab-rutina').classList.toggle('active',    tipo === 'rutina');
  document.getElementById('tab-individual').classList.toggle('active', tipo === 'individual');
  document.getElementById('campo-dias').style.display   = tipo === 'rutina'     ? 'flex' : 'none';
  document.getElementById('campo-fecha').style.display  = tipo === 'individual' ? 'flex' : 'none';
  document.getElementById('form-horario-titulo').textContent =
    tipo === 'rutina' ? 'Nueva rutina' : 'Toma individual';
  document.getElementById('btn-guardar-horario').textContent =
    tipo === 'rutina' ? 'Guardar rutina' : 'Guardar toma';
}

// ─── NUEVO HORARIO ────────────────────────────────────────────────
async function prepararFormHorario() {
  setTipo('rutina');   // siempre empieza en rutina
  await cargarMedicamentosSelect();
  // Si es médico, cargar selector de pacientes
  const selPac = document.getElementById('h-paciente');
  if (['medico','admin'].includes(state.rol)) {
    if (!state.pacientes.length) await cargarPacientes(true);
    selPac.innerHTML = '<option value="">Selecciona un paciente</option>' +
      state.pacientes.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
    selPac.closest('.campo').style.display = 'flex';
  } else {
    // Paciente ve su propio nombre, no necesita selector
    selPac.innerHTML = `<option value="${state.id_paciente}" selected>${state.usuario?.nombre}</option>`;
    selPac.closest('.campo').style.display = 'none';
  }
}

async function cargarMedicamentosSelect() {
  try {
    const res  = await apiFetch('/api/medicamentos');
    const meds = res.medicamentos ?? [];
    document.getElementById('h-medicamento').innerHTML =
      '<option value="">Selecciona un medicamento</option>' +
      meds.map(m => `<option value="${m.id}">${m.nombre} ${m.dosis_mg}mg</option>`).join('');
  } catch (_) {}
}

async function guardarHorario(event) {
  event.preventDefault();
  const errEl = document.getElementById('error-horario');
  errEl.style.display = 'none';

  const id_paciente    = document.getElementById('h-paciente').value || state.id_paciente;
  const id_medicamento = document.getElementById('h-medicamento').value;
  const hora           = document.getElementById('h-hora').value;
  const compartimento  = document.querySelector('input[name="compartimento"]:checked')?.value;

  let body = { id_paciente, id_medicamento, hora, compartimento };

  if (_tipoHorario === 'rutina') {
    const dias = [...document.querySelectorAll('#form-horario input[type="checkbox"]:checked')]
                  .map(c => c.value).join(',');
    if (!dias) { mostrarError(errEl, 'Selecciona al menos un día'); return; }
    body.dias = dias;
  } else {
    const fecha = document.getElementById('h-fecha').value;
    if (!fecha) { mostrarError(errEl, 'Selecciona una fecha'); return; }
    body.fecha_especifica = fecha;
  }

  const btn = document.getElementById('btn-guardar-horario');
  const label = _tipoHorario === 'rutina' ? 'Guardar rutina' : 'Guardar toma';
  setLoading(btn, true);
  try {
    await apiFetch('/api/horarios', 'POST', body);
    mostrarToast(_tipoHorario === 'rutina' ? 'Rutina guardada ✓' : 'Toma programada ✓', 'ok');
    setLoading(btn, false, label);
    // Resetear tipo a rutina para la próxima vez
    setTipo('rutina');
    nav('horarios');
  } catch (e) {
    mostrarError(errEl, e.message ?? 'Error al guardar');
    setLoading(btn, false, label);
  }
}

// ─── PACIENTES (médico/admin) ─────────────────────────────────────
async function cargarPacientes(silencioso = false) {
  const ul = document.getElementById('pacientes-list');
  if (!silencioso) ul.innerHTML = '<li class="empty-state">Cargando…</li>';
  try {
    const res = await apiFetch('/api/pacientes');
    state.pacientes = res.pacientes ?? [];
    if (!silencioso) renderPacientes(state.pacientes);
    // Poblar selector del historial
    poblarSelectorPacientesHist(state.pacientes);
  } catch (_) {}
}

function renderPacientes(pacientes) {
  const ul = document.getElementById('pacientes-list');
  if (!pacientes.length) {
    ul.innerHTML = '<li class="empty-state">Sin pacientes registrados.</li>';
    return;
  }
  ul.innerHTML = pacientes.map(p => `
    <li>
      <div class="paciente-card" onclick="verHistorialPaciente(${p.id}, '${p.nombre}')">
        <div class="paciente-avatar">${p.nombre.charAt(0).toUpperCase()}</div>
        <div class="paciente-info">
          <p class="paciente-nombre">${p.nombre}</p>
          <p class="paciente-meta">${p.diagnostico ?? '—'} · ${p.dispositivo_id ?? 'sin dispositivo'}</p>
        </div>
        <svg class="paciente-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
      </div>
    </li>
  `).join('');
}

function poblarSelectorPacientesHist(pacientes) {
  const sel = document.getElementById('hist-paciente');
  sel.innerHTML = '<option value="">Selecciona un paciente</option>' +
    pacientes.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
  if (state.id_paciente) sel.value = state.id_paciente;
}

async function guardarPaciente(event) {
  event.preventDefault();
  const errEl = document.getElementById('error-paciente');
  errEl.style.display = 'none';
  const btn = document.getElementById('btn-guardar-paciente');
  setLoading(btn, true);
  try {
    await apiFetch('/api/pacientes', 'POST', {
      nombre:           document.getElementById('p-nombre').value,
      fecha_nacimiento: document.getElementById('p-nacimiento').value,
      diagnostico:      document.getElementById('p-diagnostico').value || null,
      dispositivo_id:   document.getElementById('p-device').value || null,
    });
    mostrarToast('Paciente guardado ✓', 'ok');
    event.target.reset();
    setLoading(btn, false, 'Guardar paciente');
    nav('pacientes');
  } catch (e) {
    mostrarError(errEl, e.message ?? 'Error al guardar');
    setLoading(btn, false, 'Guardar paciente');
  }
}

// ─── MEDICAMENTOS (médico/admin) ──────────────────────────────────
async function cargarMedicamentos() {
  const ul = document.getElementById('medicamentos-list');
  ul.innerHTML = '<li class="empty-state">Cargando…</li>';
  try {
    const res  = await apiFetch('/api/medicamentos');
    const meds = res.medicamentos ?? [];
    if (!meds.length) { ul.innerHTML = '<li class="empty-state">Sin medicamentos.</li>'; return; }
    ul.innerHTML = meds.map(m => `
      <li class="med-card">
        <div class="med-dot" style="background:${colorPastilla(m.color_pastilla)}"></div>
        <div class="med-info">
          <p class="med-nombre">${m.nombre}</p>
          <p class="med-dosis">${m.dosis_mg}mg · ${m.instrucciones ?? '—'}</p>
        </div>
      </li>
    `).join('');
  } catch (_) {}
}

async function guardarMedicamento(event) {
  event.preventDefault();
  const errEl = document.getElementById('error-medicamento');
  errEl.style.display = 'none';
  const btn = document.getElementById('btn-guardar-med');
  setLoading(btn, true);
  try {
    await apiFetch('/api/medicamentos', 'POST', {
      nombre:        document.getElementById('m-nombre').value,
      dosis_mg:      document.getElementById('m-dosis').value,
      instrucciones: document.getElementById('m-instrucciones').value || null,
      color_pastilla:document.getElementById('m-color').value || null,
    });
    mostrarToast('Medicamento guardado ✓', 'ok');
    event.target.reset();
    setLoading(btn, false, 'Guardar medicamento');
    nav('medicamentos');
  } catch (e) {
    mostrarError(errEl, e.message ?? 'Error al guardar');
    setLoading(btn, false, 'Guardar medicamento');
  }
}

// ─── HISTORIAL ────────────────────────────────────────────────────
async function cargarHistorial() {
  // Determinar qué paciente mostrar
  let idP = state.id_paciente;
  if (['medico','admin','familiar'].includes(state.rol)) {
    const sel = document.getElementById('hist-paciente');
    if (sel.value) idP = sel.value;
  }
  if (!state.token || !idP) {
    document.getElementById('historial-list').innerHTML =
      '<li class="empty-state">Selecciona un paciente o inicia sesión.</li>';
    return;
  }

  const filtro = document.getElementById('filtro-estado').value;
  const hasta  = hoyISO();
  const desde  = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

  try {
    const res   = await apiFetch(`/api/pacientes/${idP}/historial?desde=${desde}&hasta=${hasta}&pagina=1&por_pagina=50`);
    let tomas   = res.tomas ?? [];
    if (filtro) tomas = tomas.filter(t => t.estado === filtro);
    renderHistorial(tomas);
  } catch (_) {
    document.getElementById('historial-list').innerHTML =
      '<li class="empty-state">Error al cargar historial.</li>';
  }
}

function renderHistorial(tomas) {
  const ul = document.getElementById('historial-list');
  if (!tomas.length) {
    ul.innerHTML = '<li class="empty-state">Sin registros en los últimos 7 días.</li>';
    return;
  }
  ul.innerHTML = tomas.map(t => `
    <li class="toma-item">
      <div class="toma-icon ${t.estado}">${iconoEstado(t.estado)}</div>
      <div class="toma-info">
        <p class="toma-nombre">${t.medicamento}</p>
        <p class="toma-meta">${formatFechaHora(t.fecha_programada)}</p>
      </div>
      <span class="toma-estado estado-${t.estado}">${t.estado}</span>
    </li>
  `).join('');
}

// ─── AUTH ─────────────────────────────────────────────────────────
function showForm(id) {
  hideAllForms();
  document.getElementById(id).style.display = 'block';
}
function hideAllForms() {
  ['formlogin','formregistro'].forEach(id =>
    document.getElementById(id).style.display = 'none');
}

async function login(event) {
  event.preventDefault();
  const errEl = document.getElementById('error-login');
  errEl.style.display = 'none';
  const correo     = document.getElementById('i-email-l').value;
  const contraseña = document.getElementById('i-password').value;
  const btn        = document.getElementById('btn-login-submit');
  setLoading(btn, true);
  try {
    const data = await apiPost('/api/auth/login', { correo, contraseña });
    guardarSesion(data.cuenta, data.token);
    hideAllForms();
    actualizarUIcuenta();
    actualizarPanelInicio();
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('mainmenu').classList.add('active');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === 'mainmenu'));
    cargarInicio();
  } catch (e) {
    mostrarError(errEl, e.message ?? 'Credenciales incorrectas');
  } finally {
    setLoading(btn, false, 'Entrar');
  }
}

async function registrarse(event) {
  event.preventDefault();
  const errEl = document.getElementById('error-registro');
  errEl.style.display = 'none';
  const nombre     = document.getElementById('i-name').value;
  const correo     = document.getElementById('i-email').value;
  const contraseña = document.getElementById('i-newpassword').value;
  const rol        = document.querySelector('input[name="i-rol"]:checked')?.value ?? 'paciente';
  const btn        = document.getElementById('btn-reg-submit');
  setLoading(btn, true);
  try {
    const data = await apiPost('/api/auth/registro', { nombre, correo, contraseña, rol });
    guardarSesion(data.cuenta, data.token);
    hideAllForms();
    actualizarUIcuenta();
    actualizarPanelInicio();
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('mainmenu').classList.add('active');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === 'mainmenu'));
    cargarInicio();
  } catch (e) {
    mostrarError(errEl, e.message ?? 'Error al registrarse');
  } finally {
    setLoading(btn, false, 'Registrarse');
  }
}

function logout() {
  Object.assign(state, { usuario: null, token: null, rol: null, id_paciente: null, pacientes: [] });
  localStorage.removeItem('ma_token');
  localStorage.removeItem('ma_usuario');
  aplicarRol(null);
  actualizarUIcuenta();
  actualizarPanelInicio();
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('mainmenu').classList.add('active');
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === 'mainmenu'));
}

function guardarSesion(cuenta, token) {
  // Normalizar cuenta — servidores viejos devuelven 'tipo' en vez de 'rol'
  const rol = cuenta.rol ?? cuenta.tipo_nombre ?? 'paciente';
  const cuentaNorm = { ...cuenta, rol };

  state.usuario     = cuentaNorm;
  state.token       = token ?? null;
  state.rol         = rol;
  state.id_paciente = cuenta.id_paciente ?? cuenta.id;
  localStorage.setItem('ma_token',   token ?? '');
  localStorage.setItem('ma_usuario', JSON.stringify(cuentaNorm));
  aplicarRol(state.rol);
}

function actualizarPanelInicio() {
  // Usar state.usuario como fuente de verdad — Render no siempre devuelve token
  if (state.usuario) {
    document.body.classList.remove('sin-sesion');
  } else {
    document.body.classList.add('sin-sesion');
  }
}

function actualizarUIcuenta() {
  const u = state.usuario;
  document.getElementById('c-nombre').textContent = u?.nombre ?? '—';
  document.getElementById('c-email').textContent  = u?.correo ?? 'Sin sesión';
  const rolEl = document.getElementById('c-rol');
  rolEl.textContent    = u?.rol ?? '';
  rolEl.style.display  = u?.rol ? 'inline-block' : 'none';
  const loggedIn = !!u;
  document.getElementById('btn-login-show').style.display = loggedIn ? 'none'  : 'block';
  document.getElementById('btn-reg-show').style.display   = loggedIn ? 'none'  : 'block';
  document.getElementById('btn-logout').style.display     = loggedIn ? 'block' : 'none';
}

// ─── HTTP helpers ─────────────────────────────────────────────────
async function apiFetch(path, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (state.token) opts.headers['Authorization'] = `Bearer ${state.token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);

  // Si el servidor devuelve 401, limpiar sesión
  if (res.status === 401) {
    logout();
    throw new Error('Sesión expirada');
  }

  let data;
  try {
    data = await res.json();
  } catch (_) {
    throw new Error(`Error del servidor (${res.status})`);
  }

  if (!data.ok) throw new Error(data.error ?? 'Error del servidor');
  return data;
}
async function apiPost(path, body) { return apiFetch(path, 'POST', body); }

// ─── Toast ────────────────────────────────────────────────────────
function mostrarToast(msg, tipo = 'ok') {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className   = `toast toast-${tipo} visible`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('visible'), 2800);
}

// ─── Utilidades ───────────────────────────────────────────────────
function iconoEstado(e) { return e === 'tomado' ? '✓' : e === 'omitido' ? '✗' : '◷'; }
function diasLabel(dias) {
  const n = ['','L','M','X','J','V','S','D'];
  return (Array.isArray(dias) ? dias : String(dias).split(',').map(Number)).map(d => n[d]??d).join(' ');
}
function formatHora(iso)      { return iso ? new Date(iso).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}) : '—'; }
function formatFecha(iso)     { return iso ? new Date(iso).toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric'}) : '—'; }
function formatFechaHora(iso) { return iso ? `${formatFecha(iso)} ${formatHora(iso)}` : '—'; }
function hoyISO()             { return new Date().toISOString().split('T')[0]; }
function mostrarError(el, msg){ el.textContent = msg; el.style.display = 'block'; }
function setLoading(btn, on, label = '') {
  btn.disabled = on;
  btn.innerHTML = on ? '<span class="spinner"></span>' : label;
}
function colorPastilla(color) {
  const map = { blanco:'#f5f5f5', amarillo:'#fbbf24', rosado:'#f9a8d4',
                azul:'#93c5fd', verde:'#6ee7b7', rojo:'#fca5a5', naranja:'#fdba74' };
  return map[color?.toLowerCase()] ?? 'var(--violet-light)';
}

// ─── Init ─────────────────────────────────────────────────────────
window.addEventListener('load', () => {
  // Restaurar sesión del localStorage
  const token   = localStorage.getItem('ma_token');
  const usuario = localStorage.getItem('ma_usuario');
  if (usuario) {
    try {
      const u           = JSON.parse(usuario);
      state.token       = token || null;
      state.usuario     = u;
      state.rol         = u.rol ?? 'paciente';
      state.id_paciente = u.id_paciente ?? u.id;
    } catch (_) {
      localStorage.removeItem('ma_token');
      localStorage.removeItem('ma_usuario');
    }
  }

  // Aplicar rol y actualizar UI (fuera del try para no silenciar errores)
  aplicarRol(state.rol);
  actualizarUIcuenta();
  actualizarPanelInicio();
  cargarInicio();
});
