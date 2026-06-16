// Componentes de UI reaproveitáveis: toast e modais.

export function toast(msg, type){
  const wrap = document.getElementById("toasts");
  const el = document.createElement("div");
  el.className = "toast " + (type||"");
  el.textContent = msg; wrap.appendChild(el);
  setTimeout(()=>{ el.style.opacity="0"; el.style.transition="opacity .3s"; setTimeout(()=>el.remove(),300); }, 2600);
}

export function showModal(title, bodyHTML){
  document.getElementById("modalRoot").innerHTML = `
    <div class="overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal"><div class="mh"><h3>${title}</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>
      <div class="mb">${bodyHTML}</div></div></div>`;
}

export function closeModal(){ document.getElementById("modalRoot").innerHTML = ""; }

export function confirmModal(title, msg, onYes){
  window.__yes = onYes;
  showModal(title, `<p style="color:var(--muted);margin-bottom:18px">${msg||""}</p>
    <div style="display:flex;gap:10px"><button class="btn ghost" style="flex:1" onclick="closeModal()">Cancelar</button>
    <button class="btn danger" style="flex:1" onclick="var f=window.__yes;closeModal();if(f)f();">Confirmar</button></div>`);
}
