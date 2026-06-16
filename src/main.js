// Ponto de entrada da aplicação.
// 1) importa o CSS (idêntico ao protótipo); 2) registra os handlers usados nos
// onclick do markup; 3) carrega TUDO do Supabase e renderiza.
import "./styles.css";

import { DB } from "./state.js";
import { go, render } from "./router.js";
import { hasCredentials } from "./supabase/client.js";
import * as repo from "./supabase/repo.js";
import { toast, closeModal } from "./lib/ui.js";

import {
  startBooking, pickService, pickBarber, shiftMonth, pickDate, pickTime,
  saveClient, reserveAndPay, copyPix, confirmPaid, cancelPending, downloadIcs,
} from "./views/booking.js";

import {
  setTab, filterClients, editService, saveService, delService, toggleService,
  editBarber, saveBarber, delBarber, toggleDay, editDay, saveDay, blockDate, unblockDate,
  savePix, saveContact, savePass, resetAll, adminCancel, adminReschedule, saveReschedule,
  exportCSV, exportPDF, openAdmin, tryLogin, logoutAdmin,
} from "./views/admin.js";

/* ---- handler de tema (grava no Supabase) ---- */
async function toggleTheme(){
  const cur=document.body.getAttribute("data-theme");
  const next=cur==="dark"?"light":"dark";
  document.body.setAttribute("data-theme",next);
  DB.config.theme=next;
  try{ await repo.saveConfig(); }catch(e){ console.error(e); }
}

/* ---- expõe os handlers para os onclick inline (markup inalterado) ---- */
Object.assign(window, {
  go, closeModal, toggleTheme,
  // booking
  startBooking, pickService, pickBarber, shiftMonth, pickDate, pickTime,
  saveClient, reserveAndPay, copyPix, confirmPaid, cancelPending, downloadIcs,
  // admin
  setTab, filterClients, editService, saveService, delService, toggleService,
  editBarber, saveBarber, delBarber, toggleDay, editDay, saveDay, blockDate, unblockDate,
  savePix, saveContact, savePass, resetAll, adminCancel, adminReschedule, saveReschedule,
  exportCSV, exportPDF, openAdmin, tryLogin, logoutAdmin,
});

/* ---- tela de erro amigável (credenciais ausentes / falha de conexão) ---- */
function showSetupError(detalhe){
  document.getElementById("topbar")?.classList.add("hidden");
  document.getElementById("view").innerHTML = `
    <div class="screen" style="text-align:center;padding-top:60px">
      <div class="logo-ring" style="margin:0 auto 22px"><span>M</span></div>
      <h2 style="font-family:var(--ff-display);font-size:24px">Configuração necessária</h2>
      <p style="color:var(--muted);margin-top:10px;max-width:340px;margin-inline:auto">
        Não foi possível conectar ao Supabase. Verifique as variáveis
        <b>VITE_SUPABASE_URL</b> e <b>VITE_SUPABASE_ANON_KEY</b> e se o schema foi criado.
      </p>
      <div class="pix-code" style="margin-top:16px;text-align:left">${detalhe||""}</div>
    </div>`;
  document.getElementById("footer").innerHTML = "";
}

/* ---- boot ---- */
async function init(){
  if(!hasCredentials){ showSetupError("Defina as variáveis de ambiente e recarregue."); return; }
  try{
    await repo.loadAll();
    document.body.setAttribute("data-theme", DB.config.theme || "dark");
    go("home");
    // revalida reservas expiradas de tempos em tempos
    setInterval(()=>{ repo.expireStalePending().catch(()=>{}); }, 60*1000);
  }catch(e){
    console.error(e);
    showSetupError(String(e.message||e));
  }
}
init();
