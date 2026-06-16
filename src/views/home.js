// Tela inicial (hero) e rodapé. Markup idêntico ao protótipo.
import { DB } from "../state.js";
import { escapeHtml } from "../lib/format.js";

export function viewHome(){
  const h = DB.hours[new Date().getDay()];
  const open = h && h.on;
  return `
  <div class="screen" style="padding:0">
    <div class="topbar" style="position:absolute;width:100%;background:transparent;border:none;z-index:5">
      <div></div>
      <div class="topbar-actions">
        <button class="icon-btn" title="Modo claro/escuro" onclick="toggleTheme()">◐</button>
        <button class="icon-btn" title="Administração" onclick="openAdmin()">⚙</button>
      </div>
    </div>
    <section class="hero">
      <div class="logo-ring"><span>${escapeHtml(DB.config.logo||"M")}</span></div>
      <h1>SALÃO<br>DO MARCOLA</h1>
      <div class="razor"></div>
      <p class="sub">Agende seu horário de forma rápida e prática.</p>
      <div style="width:100%;max-width:340px;margin-top:34px">
        <button class="btn" onclick="startBooking()">AGENDAR HORÁRIO</button>
      </div>
      <div style="margin-top:26px" class="hours-chip">
        <span style="width:7px;height:7px;border-radius:50%;background:${open?'var(--ok)':'var(--bad)'}"></span>
        ${open ? `Aberto hoje · ${h.start} às ${h.end}` : "Fechado hoje"}
      </div>
    </section>
  </div>`;
}

export function footerHTML(){
  const c = DB.config.contato;
  const waMsg = encodeURIComponent("Olá! Vim pelo site do Salão do Marcola e gostaria de falar com o proprietário.");
  return `<div class="foot">
    <div class="fn">Salão do Marcola</div>
    <div class="fl">${escapeHtml(c.endereco)}</div>
    <div class="fl">📞 ${escapeHtml(c.telefone)}</div>
    <div class="socials">
      <a href="${c.instagram}" target="_blank" rel="noopener" title="Instagram">📷</a>
      <a href="${c.facebook}" target="_blank" rel="noopener" title="Facebook">f</a>
      <a href="${c.maps}" target="_blank" rel="noopener" title="Google Maps">📍</a>
    </div>
    <a class="btn ghost sm" style="display:inline-flex" href="https://wa.me/${c.whatsapp}?text=${waMsg}" target="_blank" rel="noopener">💬 Falar com o proprietário</a>
    <div class="copy">© ${new Date().getFullYear()} Salão do Marcola · Agende online</div>
  </div>`;
}
