let mapcuenta = {
  nombrec: "-",
  emailc: "-",
  pacienteemail: "-",
}

function load() {
  mapcuenta.nombrec = "-"
  mapcuenta.emailc = "-"
  mapcuenta.pacienteemail = "-"
}
function cuentasform(form){
  const ci =document.querySelector('#cuenta-info')
  const vid2 = window.getComputedStyle(ci).display !== 'none'
  ci.style.display='none'
   const el = document.querySelector(`#${form}`)
  const visible = window.getComputedStyle(el).display !== 'none'

  if (visible) {
    el.style.display = 'none'
  } else {
    el.style.display = 'flex'
  }
  
}

function changeview(view) {
  document.querySelectorAll('main section').forEach(sec => {
    sec.style.display = 'none'
  });
  document.querySelector(`#${view}`).style.display = 'flex'
}
function changeviewm(view) {
  document.querySelectorAll('main section').forEach(sec => {
    sec.style.display = 'none'
  });
  document.querySelector(`#${view}`).style.display = 'flex'
}

function desplegar() {
  const el = document.querySelector('.menu .opc')
  const btn = document.querySelector('.extensor')
  const visible = window.getComputedStyle(el).display !== 'none'

  if (visible) {
    el.style.display = 'none'
    btn.classList.remove('open')
  } else {
    el.style.display = 'flex'
    btn.classList.add('open')
  }
}

async function registrarse(event) {
  event.preventDefault()
  const formReg = new FormData(event.target)
  const correo = formReg.get('email')
  const contraseña = formReg.get('newpassword')
  const nombre = formReg.get('name')

  try {
    const res = await fetch('/api/auth/registro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, correo, contraseña })
    });
    const data = await res.json();

    if (!data.ok) {
      console.error(data.error);
      // mostrar error en pantalla
    } else {
      loadcuenta()
    }
  } catch (err) {
    console.error('Error de red:', err);
  }
}

function loadcuenta() {
  document.querySelectorAll('main section').forEach(sec => {
    sec.style.display = 'none'
  });
  document.querySelectorAll('#cuenta > div').forEach(sec => {
    sec.style.display = 'none'
  });
  document.querySelector('#cuenta').style.display = 'flex'
  document.querySelector('#cuenta-info').style.display = 'flex'
  document.querySelector('#email-info').textContent = mapcuenta.emailc
  document.querySelector('#name-info').textContent = mapcuenta.nombrec
}

async function login(event) {
  event.preventDefault()
  const formReg = new FormData(event.target)
  const correo = formReg.get('email-l')
  const contraseña = formReg.get('password')

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo, contraseña })
    });
    const data = await res.json();

    if (!data.ok) {
      console.error(data.error);
      // mostrar error en pantalla
    } else {
      mapcuenta.nombrec = data.cuenta.nombre
      mapcuenta.emailc = data.cuenta.correo
      loadcuenta()
    }
  } catch (err) {
    console.error('Error de red:', err);
  }
}

function setError(id, text) {
  document.querySelector(`#i-${id}-error`).textContent = text
  const input = document.querySelector(`#i-${id}`)
  input.setCustomValidity(text);
  input.addEventListener('input', cb)
}

function cb(e) {
  e.target.setCustomValidity("");
  e.target.removeEventListener('input', cb)
}

window.addEventListener('load', load)