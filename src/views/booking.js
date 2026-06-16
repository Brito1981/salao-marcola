// Jornada do cliente: serviço, profissional, data/hora, dados, resumo, PIX, confirmação.
// Markup idêntico ao protótipo; persistência agora via repo (Supabase).
import { DB, flow, ui, publicServices, svcName, barberName } from "../state.js";
import { money, escapeHtml, ymd, todayYMD, fmtDateLong, MES, parseYMD } from "../lib/format.js";
import { freeSlots, dateHasAvailability } from "../lib/slots.js";
import { pixPayload } from "../lib/pix.js";
import { gcalLink, icsFile, waConfirmLink } from "../lib/links.js";
import { toast } from "../lib/ui.js";
import { go } from "../router.js";
import { createBooking, confirmBooking, cancelBooking } from "../supabase/repo.js";
import { viewHome } from "./home.js";

/* ---------- helpers locais ---------- */
function stepsBar(cur){
  let segs="";
  for(let i=1;i<=5;i++) segs+=`<div class="seg ${i<cur?'done':i===cur?'cur':''}"></div>`;
  return `<div class="steps">${segs}</div>`;
}

/* ---------- iniciar ---------- */
export function startBooking(){
  flow.service=null; flow.barber=null; flow.date=null; flow.time=null; flow.client={}; clearHold();
  if(publicServices().length===0){ toast("Nenhum serviço disponível no momento.","bad"); return; }
  go("service");
}

/* ===================== ETAPA 1 — SERVIÇO ===================== */
export function viewService(){
  const cards = publicServices().map(sv=>`
    <button class="card svc ${flow.service&&flow.service.id===sv.id?'sel':''}" onclick="pickService('${sv.id}')">
      <div class="ic">${sv.icon||"✂️"}</div>
      <div class="meta">
        <h3>${escapeHtml(sv.name)}</h3>
        <div class="row"><span>⏱ ${sv.dur} min</span></div>
      </div>
      <div class="price">${money(sv.price)}</div>
    </button>`).join("");
  return `<div class="screen">
    ${stepsBar(1)}
    <div class="step-head"><div class="eyebrow">Etapa 1 de 5</div><h2>Escolha o serviço</h2>
      <p>Selecione o que você deseja fazer hoje.</p></div>
    <div class="stack">${cards}</div>
  </div>`;
}
export function pickService(id){ flow.service = DB.services.find(x=>x.id===id); go("barber"); }

/* ===================== ETAPA 2 — BARBEIRO ===================== */
export function viewBarber(){
  const barbers = DB.barbers.filter(b=>b.ativo!==false);
  if(barbers.length===1){ flow.barber=barbers[0]; setTimeout(()=>go("datetime"),0);
    return `<div class="screen"><div class="empty">Carregando…</div></div>`; }
  const cards = barbers.map(b=>`
    <button class="card svc ${flow.barber&&flow.barber.id===b.id?'sel':''}" onclick="pickBarber('${b.id}')">
      <div class="ic">${b.icon||"💈"}</div>
      <div class="meta"><h3>${escapeHtml(b.name)}</h3><div class="row"><span>${escapeHtml(b.role||"Barbeiro")}</span></div></div>
      <div class="check">✓</div>
    </button>`).join("");
  return `<div class="screen">
    ${stepsBar(2)}
    <a class="back-link" onclick="go('service')">‹ Voltar</a>
    <div class="step-head"><div class="eyebrow">Etapa 2 de 5</div><h2>Escolha o profissional</h2>
      <p>Quem vai te atender?</p></div>
    <div class="stack">${cards}</div>
  </div>`;
}
export function pickBarber(id){ flow.barber=DB.barbers.find(x=>x.id===id); go("datetime"); }

/* ===================== ETAPA 3 — DATA + HORA ===================== */
export function viewDateTime(){
  const onlyOne = DB.barbers.filter(b=>b.ativo!==false).length===1;
  return `<div class="screen">
    ${stepsBar(3)}
    <a class="back-link" onclick="go('${onlyOne?'service':'barber'}')">‹ Voltar</a>
    <div class="step-head"><div class="eyebrow">Etapa 3 de 5</div><h2>Data e horário</h2>
      <p>Toque numa data disponível e escolha o horário.</p></div>
    <div id="calWrap">${calendarHTML()}</div>
    <div id="slotsWrap" style="margin-top:20px">${flow.date?slotsHTML():''}</div>
  </div>`;
}
function calendarHTML(){
  const y=ui.calMonth.getFullYear(), m=ui.calMonth.getMonth();
  const first=new Date(y,m,1); const startDow=first.getDay();
  const days=new Date(y,m+1,0).getDate();
  const today=new Date(); today.setHours(0,0,0,0);
  const minMonth=new Date(); minMonth.setDate(1); minMonth.setHours(0,0,0,0);
  const prevDisabled = (y<minMonth.getFullYear()||(y===minMonth.getFullYear()&&m<=minMonth.getMonth()));
  let cells="";
  for(let i=0;i<startDow;i++) cells+=`<div class="day empty"></div>`;
  for(let d=1;d<=days;d++){
    const date=new Date(y,m,d); const ds=ymd(date);
    const isPast = date<today;
    const isToday = ds===todayYMD();
    const avail = !isPast && dateHasAvailability(DB, ds, flow.service);
    const sel = flow.date===ds;
    let cls="day";
    if(isPast||!avail) cls+=" off"; else cls+=" avail";
    if(sel) cls+=" sel"; if(isToday) cls+=" today";
    cells+=`<div class="${cls}" ${avail&&!isPast?`onclick="pickDate('${ds}')"`:''}>${d}</div>`;
  }
  return `<div class="cal">
    <div class="cal-top">
      <button class="nav" ${prevDisabled?'disabled':''} onclick="shiftMonth(-1)">‹</button>
      <div class="m">${MES[m]} ${y}</div>
      <button class="nav" onclick="shiftMonth(1)">›</button>
    </div>
    <div class="dow">${["D","S","T","Q","Q","S","S"].map(x=>`<span>${x}</span>`).join("")}</div>
    <div class="grid7">${cells}</div>
  </div>`;
}
export function shiftMonth(n){ ui.calMonth.setMonth(ui.calMonth.getMonth()+n); document.getElementById("calWrap").innerHTML=calendarHTML(); }
export function pickDate(ds){
  flow.date=ds; flow.time=null;
  document.getElementById("calWrap").innerHTML=calendarHTML();
  document.getElementById("slotsWrap").innerHTML=slotsHTML();
  document.getElementById("slotsWrap").scrollIntoView({behavior:"smooth",block:"nearest"});
}
function slotsHTML(){
  const all=freeSlots(DB, flow.date, flow.service.dur);
  if(all.length===0) return `<div class="empty"><div class="e-ic">🕐</div>Sem horários para esta data.</div>`;
  const groups={Manhã:[],Tarde:[],Noite:[]};
  all.forEach(x=>{ const h=parseInt(x.time); (h<12?groups.Manhã:h<18?groups.Tarde:groups.Noite).push(x); });
  let html="";
  for(const g of ["Manhã","Tarde","Noite"]){
    if(groups[g].length===0) continue;
    html+=`<div class="period-label">${g}</div><div class="slots">`;
    html+=groups[g].map(x=>`<button class="slot ${flow.time===x.time?'sel':''}" ${x.free?`onclick="pickTime('${x.time}')"`:'disabled'}>${x.time}</button>`).join("");
    html+=`</div>`;
  }
  html+=`<div class="sticky-cta"><button class="btn" ${flow.time?'':'disabled'} onclick="go('client')">${flow.time?`Continuar · ${flow.time}`:"Escolha um horário"}</button></div>`;
  return html;
}
export function pickTime(t){ flow.time=t; document.getElementById("slotsWrap").innerHTML=slotsHTML(); }

/* ===================== ETAPA 4 — CLIENTE ===================== */
export function viewClient(){
  const c=flow.client;
  return `<div class="screen">
    ${stepsBar(4)}
    <a class="back-link" onclick="go('datetime')">‹ Voltar</a>
    <div class="step-head"><div class="eyebrow">Etapa 4 de 5</div><h2>Seus dados</h2>
      <p>Para confirmarmos e enviarmos os lembretes.</p></div>
    <div class="field" id="f-name"><label>Nome completo</label>
      <input class="input" id="i-name" value="${escapeHtml(c.name||'')}" placeholder="Como podemos te chamar?" autocomplete="name"/>
      <div class="err">Informe seu nome.</div></div>
    <div class="field" id="f-phone"><label>Telefone (WhatsApp)</label>
      <input class="input" id="i-phone" value="${escapeHtml(c.phone||'')}" placeholder="(21) 99999-0000" inputmode="tel" autocomplete="tel"/>
      <div class="err">Informe um telefone válido.</div></div>
    <div class="field"><label>Email <span class="opt">(opcional)</span></label>
      <input class="input" id="i-email" value="${escapeHtml(c.email||'')}" placeholder="voce@email.com" inputmode="email"/></div>
    <div class="field"><label>Observações <span class="opt">(opcional)</span></label>
      <textarea class="input" id="i-notes" placeholder="Ex.: prefiro máquina 2, alergia a álcool…">${escapeHtml(c.notes||'')}</textarea></div>
    <div class="sticky-cta"><button class="btn" onclick="saveClient()">Revisar agendamento</button></div>
  </div>`;
}
export function saveClient(){
  const name=document.getElementById("i-name").value.trim();
  const phone=document.getElementById("i-phone").value.trim();
  let ok=true;
  document.getElementById("f-name").classList.toggle("invalid", !name); if(!name) ok=false;
  const digits=phone.replace(/\D/g,"");
  document.getElementById("f-phone").classList.toggle("invalid", digits.length<10); if(digits.length<10) ok=false;
  if(!ok){ toast("Confira os campos destacados.","bad"); return; }
  flow.client={ name, phone, email:document.getElementById("i-email").value.trim(), notes:document.getElementById("i-notes").value.trim() };
  go("summary");
}

/* ===================== ETAPA 5 — RESUMO ===================== */
export function viewSummary(){
  const f=flow;
  return `<div class="screen">
    ${stepsBar(5)}
    <a class="back-link" onclick="go('client')">‹ Voltar</a>
    <div class="step-head"><div class="eyebrow">Etapa 5 de 5</div><h2>Confira tudo</h2>
      <p>Revise antes de seguir para o pagamento.</p></div>
    <div class="receipt">
      <div class="rt"><div class="ic" style="width:46px;height:46px;border-radius:12px;display:grid;place-items:center;background:var(--elev);border:1px solid var(--line);font-size:22px">${f.service.icon||"✂️"}</div>
        <div><div style="font-weight:700;font-size:16px">${escapeHtml(f.service.name)}</div>
        <div style="color:var(--muted);font-size:13px">${escapeHtml(f.client.name)}</div></div></div>
      <div class="ri"><span class="k">Profissional</span><span class="v">${escapeHtml(f.barber.name)}</span></div>
      <div class="ri"><span class="k">Data</span><span class="v">${fmtDateLong(f.date)}</span></div>
      <div class="ri"><span class="k">Horário</span><span class="v">${f.time}</span></div>
      <div class="ri"><span class="k">Duração</span><span class="v">${f.service.dur} min</span></div>
      <div class="ri"><span class="k">Telefone</span><span class="v">${escapeHtml(f.client.phone)}</span></div>
      ${f.client.notes?`<div class="ri"><span class="k">Obs.</span><span class="v">${escapeHtml(f.client.notes)}</span></div>`:''}
      <div class="ri total"><span class="k">Valor</span><span class="v">${money(f.service.price)}</span></div>
    </div>
    <div class="sticky-cta"><button class="btn" id="btnPay" onclick="reserveAndPay()">Continuar para pagamento</button></div>
  </div>`;
}

/* cria reserva PENDENTE (segura o horário por 15 min) */
export async function reserveAndPay(){
  const f=flow;
  const slots=freeSlots(DB, f.date, f.service.dur);
  const ok=slots.find(x=>x.time===f.time && x.free);
  if(!ok){ toast("Esse horário acabou de ser reservado. Escolha outro.","bad"); go("datetime"); return; }
  const btn=document.getElementById("btnPay"); if(btn){ btn.disabled=true; btn.textContent="Reservando…"; }
  try{
    const b = await createBooking(f);
    flow.pendingId=b.id;
    startHold();
    go("payment");
  }catch(e){
    if(e.code==="SLOT_OCUPADO"){ toast("Esse horário acabou de ser reservado. Escolha outro.","bad"); go("datetime"); }
    else { console.error(e); toast("Não foi possível reservar agora. Tente novamente.","bad");
      if(btn){ btn.disabled=false; btn.textContent="Continuar para pagamento"; } }
  }
}

/* ---------- hold de 15 minutos ---------- */
export function startHold(){
  clearHold();
  flow.holdUntil=Date.now()+15*60*1000;
  flow.holdTimer=setInterval(async ()=>{
    const left=flow.holdUntil-Date.now();
    const el=document.getElementById("cdTime");
    if(left<=0){
      clearHold();
      try{ await cancelBooking(flow.pendingId,"Expirado (pagamento não confirmado)"); }catch(e){}
      toast("Tempo esgotado — o horário foi liberado.","bad");
      startBooking(); return;
    }
    if(el){ const mm=Math.floor(left/60000), ss=Math.floor((left%60000)/1000);
      el.textContent=String(mm).padStart(2,"0")+":"+String(ss).padStart(2,"0"); }
  },1000);
}
export function clearHold(){ if(flow.holdTimer){ clearInterval(flow.holdTimer); flow.holdTimer=null; } }

/* ===================== ETAPA 6 — PAGAMENTO (PIX) ===================== */
export function viewPayment(){
  const f=flow;
  return `<div class="screen">
    <div class="step-head" style="text-align:center"><div class="eyebrow">Pagamento</div><h2>Pague com PIX</h2>
      <p>Escaneie o QR Code ou use o Copia e Cola.</p></div>
    <div class="countdown">⏳ Horário reservado por <strong id="cdTime">15:00</strong></div>
    <div class="pix-box">
      <div id="qrcode"></div>
      <div style="font-size:22px;font-weight:800;color:var(--gold)">${money(f.service.price)}</div>
      <div style="color:var(--muted);font-size:13px;margin:2px 0 14px">${escapeHtml(DB.config.pix.recebedor)} · ${escapeHtml(DB.config.pix.banco)}</div>
      <div class="pix-code" id="pixCode"></div>
      <button class="btn ghost sm" style="width:100%;margin-top:12px" onclick="copyPix()">📋 Copiar código PIX</button>
    </div>
    <div class="help">Após pagar, toque no botão abaixo para confirmarmos seu horário.</div>
    <div class="sticky-cta"><button class="btn" onclick="confirmPaid()">Já realizei o pagamento</button></div>
    <button class="btn ghost sm" style="width:100%;margin-top:8px" onclick="cancelPending()">Cancelar</button>
  </div>`;
}
let _pix="";
export function renderPix(){
  const f=flow; if(!f.service) return;
  const protocol=(DB.bookings.find(b=>b.id===f.pendingId)||{}).protocol||"***";
  _pix=pixPayload(DB.config.pix, f.service.price, protocol);
  const box=document.getElementById("qrcode");
  try{
    const qr=window.qrcode(0,"M"); qr.addData(_pix); qr.make();
    box.innerHTML=qr.createImgTag(5,0);
    const img=box.querySelector("img"); if(img){ img.style.width="100%"; img.style.height="100%"; img.style.imageRendering="pixelated"; }
  }catch(e){ box.innerHTML='<span style="color:#333;font-size:12px;padding:10px">Use o código abaixo</span>'; }
  document.getElementById("pixCode").textContent=_pix;
}
export function copyPix(){
  navigator.clipboard?.writeText(_pix).then(()=>toast("Código PIX copiado!","ok"))
    .catch(()=>toast("Copie manualmente o código abaixo.","bad"));
}
export async function confirmPaid(){
  clearHold();
  try{ await confirmBooking(flow.pendingId); go("done"); }
  catch(e){ console.error(e); toast("Não foi possível confirmar. Tente novamente.","bad"); }
}
export async function cancelPending(){
  clearHold();
  try{ await cancelBooking(flow.pendingId,"Cancelado pelo cliente"); }catch(e){}
  toast("Agendamento cancelado.","");
  go("home");
}

/* ===================== ETAPA 7 — CONFIRMAÇÃO ===================== */
export function viewDone(){
  const b=DB.bookings.find(x=>x.id===flow.pendingId); if(!b) return viewHome();
  return `<div class="screen" style="text-align:center">
    <div class="done-mark">✓</div>
    <h2 style="font-family:var(--ff-display);font-size:27px">Agendamento confirmado!</h2>
    <p style="color:var(--muted);margin-top:6px">Te esperamos no Salão do Marcola.</p>
    <div class="proto">${b.protocol}</div>
    <div class="receipt" style="margin-top:22px;text-align:left">
      <div class="ri"><span class="k">Serviço</span><span class="v">${svcName(b.serviceId)}</span></div>
      <div class="ri"><span class="k">Cliente</span><span class="v">${escapeHtml(b.client.name)}</span></div>
      <div class="ri"><span class="k">Data</span><span class="v">${fmtDateLong(b.date)}</span></div>
      <div class="ri"><span class="k">Horário</span><span class="v">${b.time}</span></div>
      <div class="ri total"><span class="k">Valor pago</span><span class="v">${money(b.price)}</span></div>
    </div>
    <div class="grid-actions">
      <a class="btn ghost" href="${gcalLink(DB,b,svcName,barberName)}" target="_blank" rel="noopener">📅 Google Agenda</a>
      <button class="btn ghost" onclick="downloadIcs('${b.id}')">💾 Salvar (.ics)</button>
    </div>
    <a class="btn" style="margin-top:11px" href="${waConfirmLink(DB,b,svcName,barberName)}" target="_blank" rel="noopener">💬 Enviar confirmação no WhatsApp</a>
    <button class="btn ghost" style="margin-top:11px" onclick="go('home')">Voltar ao início</button>
    <div class="help" style="margin-top:18px">Precisa cancelar? Use o protocolo acima na opção “Falar com o proprietário”.</div>
  </div>`;
}
export function downloadIcs(id){
  const b=DB.bookings.find(x=>x.id===id); if(!b) return;
  icsFile(DB, b, svcName);
}
