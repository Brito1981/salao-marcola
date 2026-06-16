// Painel administrativo. Todas as alterações são gravadas no Supabase (via repo)
// e o estado em memória é atualizado em seguida. Inclui reordenação de serviços
// por arrastar e soltar (SortableJS), atualizando o campo "ordem" no banco.
import Sortable from "sortablejs";
import { DB, ui, svcName, barberName } from "../state.js";
import { money, escapeHtml, fmtDateLong, todayYMD, toMin, WD, parseYMD } from "../lib/format.js";
import { activeBookings, expired } from "../lib/slots.js";
import { toast, showModal, closeModal, confirmModal } from "../lib/ui.js";
import { go } from "../router.js";
import * as repo from "../supabase/repo.js";

/* ===================== Shell do painel ===================== */
export function viewAdmin(){
  const tabs=[["dash","Dashboard"],["agenda","Agenda"],["clients","Clientes"],["services","Serviços"],
    ["barbers","Profissionais"],["schedule","Horários"],["pix","PIX"],["settings","Config"]];
  return `<div class="screen">
    <div style="display:flex;justify-content:space-between;align-items:center;padding-top:6px">
      <div><div class="eyebrow" style="color:var(--gold);font-size:12px;font-weight:700;letter-spacing:.18em">PAINEL</div>
      <h2 style="font-family:var(--ff-display);font-size:24px">Administração</h2></div>
      <button class="btn ghost sm" onclick="logoutAdmin()">Sair</button>
    </div>
    <div class="admin-tabs">${tabs.map(([k,l])=>`<button class="tab ${ui.adminTab===k?'active':''}" onclick="setTab('${k}')">${l}</button>`).join("")}</div>
    <div id="adminBody">${adminBody()}</div>
  </div>`;
}
export function setTab(t){ ui.adminTab=t; document.getElementById("adminBody").innerHTML=adminBody(); bindAdmin(); }

/** Ganchos pós-render: inicia o drag-and-drop na aba Serviços. */
export function bindAdmin(){
  if(ui.adminTab==="services"){
    const list=document.getElementById("svcSortable");
    if(list && !list._sortable){
      list._sortable = Sortable.create(list,{
        handle:".drag", animation:150, ghostClass:"sortable-ghost",
        onEnd: async ()=>{
          const ids=[...list.querySelectorAll("[data-id]")].map(n=>n.dataset.id);
          try{ await repo.reorderServices(ids); toast("Ordem atualizada.","ok"); }
          catch(e){ console.error(e); toast("Não foi possível salvar a ordem.","bad"); }
          setTab("services");
        }
      });
    }
  }
}

function adminBody(){
  switch(ui.adminTab){
    case "dash": return admDash();
    case "agenda": return admAgenda();
    case "clients": return admClients();
    case "services": return admServices();
    case "barbers": return admBarbers();
    case "schedule": return admSchedule();
    case "pix": return admPix();
    case "settings": return admSettings();
  }
}

/* ===================== Dashboard ===================== */
function admDash(){
  const act=activeBookings(DB).filter(b=>b.status==="confirmado");
  const t=todayYMD(); const now=new Date();
  const weekEnd=new Date(); weekEnd.setDate(now.getDate()+7);
  const monthEnd=new Date(now.getFullYear(),now.getMonth()+1,0);
  const inRange=(ds,end)=>{ const d=parseYMD(ds); return d>=new Date(now.getFullYear(),now.getMonth(),now.getDate()) && d<=end; };
  const today=act.filter(b=>b.date===t);
  const week=act.filter(b=>inRange(b.date,weekEnd));
  const month=act.filter(b=>inRange(b.date,monthEnd));
  const fatur=month.reduce((s,b)=>s+b.price,0);
  const cnt={}; act.forEach(b=>cnt[b.serviceId]=(cnt[b.serviceId]||0)+1);
  const topSvc=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0];
  const hcnt={}; act.forEach(b=>hcnt[b.time]=(hcnt[b.time]||0)+1);
  const topH=Object.entries(hcnt).sort((a,b)=>b[1]-a[1])[0];
  const byPhone={}; act.forEach(b=>{ const p=(b.client.phone||"").replace(/\D/g,""); byPhone[p]=(byPhone[p]||0)+1; });
  const novos=Object.values(byPhone).filter(n=>n===1).length;
  const recor=Object.values(byPhone).filter(n=>n>1).length;
  return `
    <div class="kpis">
      <div class="kpi"><div class="kl">Hoje</div><div class="kv">${today.length}</div></div>
      <div class="kpi"><div class="kl">Próximos 7 dias</div><div class="kv">${week.length}</div></div>
      <div class="kpi"><div class="kl">Este mês</div><div class="kv">${month.length}</div></div>
      <div class="kpi"><div class="kl">Faturamento previsto (mês)</div><div class="kv g">${money(fatur)}</div></div>
    </div>
    <div class="section-title">Indicadores</div>
    <div class="stack">
      <div class="list-row"><div class="info"><h4>Serviço mais vendido</h4><p>${topSvc?svcName(topSvc[0])+" · "+topSvc[1]+"x":"—"}</p></div></div>
      <div class="list-row"><div class="info"><h4>Horário mais procurado</h4><p>${topH?topH[0]+" · "+topH[1]+"x":"—"}</p></div></div>
      <div class="list-row"><div class="info"><h4>Clientes novos</h4><p>${novos} cliente(s)</p></div></div>
      <div class="list-row"><div class="info"><h4>Clientes recorrentes</h4><p>${recor} cliente(s)</p></div></div>
    </div>`;
}

/* ===================== Agenda ===================== */
function admAgenda(){
  const list=DB.bookings.slice().sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time))
    .filter(b=>b.status!=="cancelado");
  const upcoming=list.filter(b=>b.date>=todayYMD());
  const rows = upcoming.length? upcoming.map(b=>{
    const exp=expired(b);
    const st=exp?"canc":b.status==="confirmado"?"conf":"pend";
    const lbl=exp?"Expirado":b.status==="confirmado"?"Confirmado":"Pendente";
    return `<div class="list-row"><div class="info">
      <h4>${b.time} · ${svcName(b.serviceId)} <span class="badge ${st}">${lbl}</span></h4>
      <p>${fmtDateLong(b.date)} · ${escapeHtml(b.client.name)} · ${escapeHtml(b.client.phone)}</p>
      <p style="color:var(--faint)">${b.protocol} · ${money(b.price)}</p></div>
      <div class="row-actions">
        <button class="mini" title="Reagendar" onclick="adminReschedule('${b.id}')">↻</button>
        <a class="mini" title="WhatsApp" href="https://wa.me/${(b.client.phone||'').replace(/\D/g,'')}" target="_blank" rel="noopener">💬</a>
        <button class="mini del" title="Cancelar" onclick="adminCancel('${b.id}')">✕</button>
      </div></div>`; }).join("")
    : `<div class="empty"><div class="e-ic">📅</div>Nenhum agendamento futuro.</div>`;
  return `<div style="display:flex;gap:9px;margin:4px 0 14px">
      <button class="btn ghost sm" style="flex:1" onclick="exportCSV()">⬇ Excel (CSV)</button>
      <button class="btn ghost sm" style="flex:1" onclick="exportPDF()">⬇ PDF</button>
    </div>
    <div class="stack">${rows}</div>`;
}

/* ===================== Clientes ===================== */
function admClients(){
  const map={};
  DB.bookings.filter(b=>b.status!=="cancelado").forEach(b=>{
    const k=(b.client.phone||"").replace(/\D/g,"")||b.client.name;
    if(!map[k]) map[k]={name:b.client.name,phone:b.client.phone,email:b.client.email,count:0,last:"",spent:0};
    map[k].count++; map[k].spent+=b.price;
    if(b.date>map[k].last) map[k].last=b.date;
  });
  const clients=Object.values(map).sort((a,b)=>b.count-a.count);
  return `<div class="field" style="margin-top:8px"><input class="input" id="cliSearch" placeholder="🔍 Buscar por nome ou telefone" oninput="filterClients()"/></div>
    <div class="stack" id="cliList">${clientRows(clients)}</div>`;
}
function clientRows(clients){
  if(!clients.length) return `<div class="empty"><div class="e-ic">👤</div>Nenhum cliente ainda.</div>`;
  return clients.map(c=>`<div class="list-row" data-search="${escapeHtml((c.name+" "+c.phone).toLowerCase())}">
    <div class="info"><h4>${escapeHtml(c.name)} ${c.count>1?'<span class="badge conf">Recorrente</span>':'<span class="badge pend">Novo</span>'}</h4>
      <p>${escapeHtml(c.phone)}${c.email?" · "+escapeHtml(c.email):""}</p>
      <p style="color:var(--faint)">${c.count} visita(s) · ${money(c.spent)} · último: ${c.last?fmtDateLong(c.last):"—"}</p></div>
    <a class="mini" title="WhatsApp" href="https://wa.me/${(c.phone||'').replace(/\D/g,'')}" target="_blank" rel="noopener">💬</a>
  </div>`).join("");
}
export function filterClients(){
  const q=document.getElementById("cliSearch").value.toLowerCase().trim();
  document.querySelectorAll("#cliList .list-row").forEach(r=>{
    r.style.display = r.dataset.search.includes(q) ? "" : "none";
  });
}

/* ===================== Serviços (com Drag & Drop) ===================== */
function admServices(){
  const ordered=DB.services.slice().sort((a,b)=>(a.ordem||0)-(b.ordem||0));
  const rows=ordered.map(sv=>`<div class="list-row" data-id="${sv.id}" style="${sv.ativo?'':'opacity:.55'}">
    <div style="display:flex;align-items:center;gap:10px;min-width:0;flex:1">
      <span class="drag" title="Arraste para reordenar" style="cursor:grab;color:var(--faint);font-size:18px;user-select:none;touch-action:none">⋮⋮</span>
      <div class="info"><h4>${sv.icon||""} ${escapeHtml(sv.name)} ${sv.ativo?'':'<span class="badge canc">Inativo</span>'}</h4>
        <p>${money(sv.price)} · ${sv.dur} min</p></div>
    </div>
    <div class="row-actions">
      <button class="mini" title="${sv.ativo?'Desativar':'Ativar'}" onclick="toggleService('${sv.id}')">${sv.ativo?'⏸':'▶'}</button>
      <button class="mini" title="Editar" onclick="editService('${sv.id}')">✎</button>
      <button class="mini del" title="Excluir" onclick="delService('${sv.id}')">🗑</button>
    </div></div>`).join("");
  return `<button class="btn sm" style="width:100%;margin:8px 0 14px" onclick="editService()">+ Novo serviço</button>
    <div class="stack" id="svcSortable">${rows||'<div class="empty">Nenhum serviço.</div>'}</div>
    <div class="help">Arraste pelo ícone ⋮⋮ para mudar a ordem em que os serviços aparecem para o cliente. A nova ordem é salva automaticamente.</div>`;
}
export function editService(id){
  const sv=id?DB.services.find(x=>x.id===id):{name:"",price:"",dur:"",icon:"✂️"};
  showModal(id?"Editar serviço":"Novo serviço",`
    <div class="field"><label>Nome</label><input class="input" id="sv-name" value="${escapeHtml(sv.name)}"/></div>
    <div class="grid2">
      <div class="field"><label>Preço (R$)</label><input class="input" id="sv-price" type="number" step="0.01" value="${sv.price}"/></div>
      <div class="field"><label>Duração (min)</label><input class="input" id="sv-dur" type="number" step="5" value="${sv.dur}"/></div>
    </div>
    <div class="field"><label>Ícone (emoji)</label><input class="input" id="sv-icon" value="${sv.icon||'✂️'}"/></div>
    <button class="btn" onclick="saveService('${id||''}')">Salvar</button>`);
}
export async function saveService(id){
  const name=document.getElementById("sv-name").value.trim();
  const price=parseFloat(document.getElementById("sv-price").value);
  const dur=parseInt(document.getElementById("sv-dur").value);
  if(!name||isNaN(price)||isNaN(dur)||dur<5){ toast("Preencha nome, preço e duração.","bad"); return; }
  const icon=document.getElementById("sv-icon").value.trim()||"✂️";
  try{
    if(id) await repo.updateService(id,{name,price,dur,icon});
    else   await repo.addService({name,price,dur,icon});
    closeModal(); toast("Serviço salvo.","ok"); setTab("services");
  }catch(e){ console.error(e); toast("Erro ao salvar serviço.","bad"); }
}
export function delService(id){
  confirmModal("Excluir serviço?","Agendamentos já feitos não são afetados.",async()=>{
    try{ await repo.deleteService(id); setTab("services"); toast("Serviço excluído.",""); }
    catch(e){ console.error(e); toast("Erro ao excluir.","bad"); }
  });
}
export async function toggleService(id){
  try{ await repo.toggleService(id); setTab("services"); }
  catch(e){ console.error(e); toast("Erro ao atualizar.","bad"); }
}

/* ===================== Profissionais ===================== */
function admBarbers(){
  const rows=DB.barbers.map(b=>`<div class="list-row"><div class="info">
    <h4>${b.icon||"💈"} ${escapeHtml(b.name)}</h4><p>${escapeHtml(b.role||"Barbeiro")}</p></div>
    <div class="row-actions"><button class="mini" onclick="editBarber('${b.id}')">✎</button>
    ${DB.barbers.length>1?`<button class="mini del" onclick="delBarber('${b.id}')">🗑</button>`:''}</div></div>`).join("");
  return `<button class="btn sm" style="width:100%;margin:8px 0 14px" onclick="editBarber()">+ Novo profissional</button>
    <div class="stack">${rows}</div>
    <div class="help">Com mais de um profissional, o cliente poderá escolher na Etapa 2 automaticamente.</div>`;
}
export function editBarber(id){
  const b=id?DB.barbers.find(x=>x.id===id):{name:"",role:"Barbeiro",icon:"💈"};
  showModal(id?"Editar profissional":"Novo profissional",`
    <div class="field"><label>Nome</label><input class="input" id="bb-name" value="${escapeHtml(b.name)}"/></div>
    <div class="field"><label>Função</label><input class="input" id="bb-role" value="${escapeHtml(b.role||'')}"/></div>
    <div class="field"><label>Ícone (emoji)</label><input class="input" id="bb-icon" value="${b.icon||'💈'}"/></div>
    <button class="btn" onclick="saveBarber('${id||''}')">Salvar</button>`);
}
export async function saveBarber(id){
  const name=document.getElementById("bb-name").value.trim();
  if(!name){ toast("Informe o nome.","bad"); return; }
  const role=document.getElementById("bb-role").value.trim(), icon=document.getElementById("bb-icon").value.trim()||"💈";
  try{
    if(id) await repo.updateBarber(id,{name,role,icon});
    else   await repo.addBarber({name,role,icon});
    closeModal(); setTab("barbers"); toast("Profissional salvo.","ok");
  }catch(e){ console.error(e); toast("Erro ao salvar.","bad"); }
}
export function delBarber(id){
  confirmModal("Excluir profissional?","",async()=>{
    try{ await repo.deleteBarber(id); setTab("barbers"); }catch(e){ console.error(e); toast("Erro ao excluir.","bad"); }
  });
}

/* ===================== Horários ===================== */
function admSchedule(){
  const hoursRows=[1,2,3,4,5,6,0].map(d=>{
    const h=DB.hours[d];
    return `<div class="list-row"><div class="info"><h4>${WD[d]}</h4>
      <p>${h.on?h.start+" – "+h.end:"Folga"}</p></div>
      <div class="row-actions">
        <button class="mini ${h.on?'':'del'}" title="${h.on?'Marcar folga':'Ativar'}" onclick="toggleDay(${d})">${h.on?'✓':'✕'}</button>
        <button class="mini" title="Editar horário" onclick="editDay(${d})">✎</button>
      </div></div>`;
  }).join("");
  const blocked=DB.blockedDates.length?DB.blockedDates.slice().sort().map(ds=>`<div class="list-row"><div class="info"><h4>${fmtDateLong(ds)}</h4><p>Dia bloqueado</p></div><button class="mini del" onclick="unblockDate('${ds}')">✕</button></div>`).join(""):'<div class="empty">Nenhuma data bloqueada.</div>';
  return `<div class="section-title">Horário de trabalho</div><div class="stack">${hoursRows}</div>
    <div class="section-title">Bloquear data específica</div>
    <div style="display:flex;gap:9px"><input class="input" id="blkDate" type="date" min="${todayYMD()}"/><button class="btn sm" onclick="blockDate()">Bloquear</button></div>
    <div class="stack" style="margin-top:12px">${blocked}</div>
    <div class="help">Use “Bloquear data” para feriados/folgas pontuais. As datas bloqueadas somem da agenda pública na hora.</div>`;
}
export async function toggleDay(d){ DB.hours[d].on=!DB.hours[d].on; await persistConfig(); setTab("schedule"); }
export function editDay(d){
  const h=DB.hours[d];
  showModal("Horário · "+WD[d],`
    <div class="grid2">
      <div class="field"><label>Abre</label><input class="input" id="hd-start" type="time" value="${h.start}"/></div>
      <div class="field"><label>Fecha</label><input class="input" id="hd-end" type="time" value="${h.end}"/></div>
    </div>
    <button class="btn" onclick="saveDay(${d})">Salvar</button>`);
}
export async function saveDay(d){
  DB.hours[d].start=document.getElementById("hd-start").value;
  DB.hours[d].end=document.getElementById("hd-end").value;
  DB.hours[d].on=true; await persistConfig(); closeModal(); setTab("schedule"); toast("Horário atualizado.","ok");
}
export async function blockDate(){
  const v=document.getElementById("blkDate").value;
  if(!v) return; if(!DB.blockedDates.includes(v)) DB.blockedDates.push(v);
  await persistConfig(); setTab("schedule"); toast("Data bloqueada.","ok");
}
export async function unblockDate(ds){ DB.blockedDates=DB.blockedDates.filter(x=>x!==ds); await persistConfig(); setTab("schedule"); }

/* ===================== PIX ===================== */
function admPix(){
  const p=DB.config.pix;
  return `<div class="section-title">Dados de recebimento PIX</div>
    <div class="field"><label>Nome do recebedor</label><input class="input" id="px-rec" value="${escapeHtml(p.recebedor)}"/></div>
    <div class="field"><label>Chave PIX</label><input class="input" id="px-key" value="${escapeHtml(p.chave)}"/>
      <div class="help">CPF, e-mail, telefone ou chave aleatória.</div></div>
    <div class="grid2">
      <div class="field"><label>Banco</label><input class="input" id="px-bank" value="${escapeHtml(p.banco)}"/></div>
      <div class="field"><label>Cidade</label><input class="input" id="px-city" value="${escapeHtml(p.cidade||'')}"/></div>
    </div>
    <button class="btn" onclick="savePix()">Salvar dados PIX</button>
    <div class="help" style="margin-top:14px">O QR Code é gerado no padrão BR Code do Banco Central. Confira a chave antes de divulgar o link.</div>`;
}
export async function savePix(){
  const p=DB.config.pix;
  p.recebedor=document.getElementById("px-rec").value.trim();
  p.chave=document.getElementById("px-key").value.trim();
  p.banco=document.getElementById("px-bank").value.trim();
  p.cidade=document.getElementById("px-city").value.trim();
  await persistConfig(); toast("Dados PIX salvos.","ok");
}

/* ===================== Config ===================== */
function admSettings(){
  const c=DB.config.contato;
  return `<div class="section-title">Contato e redes (rodapé)</div>
    <div class="field"><label>Endereço</label><input class="input" id="ct-addr" value="${escapeHtml(c.endereco)}"/></div>
    <div class="field"><label>Telefone</label><input class="input" id="ct-tel" value="${escapeHtml(c.telefone)}"/></div>
    <div class="field"><label>WhatsApp (só números, com DDI 55)</label><input class="input" id="ct-wa" value="${escapeHtml(c.whatsapp)}"/></div>
    <div class="field"><label>Instagram (URL)</label><input class="input" id="ct-ig" value="${escapeHtml(c.instagram)}"/></div>
    <div class="field"><label>Facebook (URL)</label><input class="input" id="ct-fb" value="${escapeHtml(c.facebook)}"/></div>
    <div class="field"><label>Google Maps (URL)</label><input class="input" id="ct-maps" value="${escapeHtml(c.maps)}"/></div>
    <button class="btn" onclick="saveContact()">Salvar contato</button>
    <div class="section-title">Segurança</div>
    <div class="field"><label>Nova senha do painel</label><input class="input" id="ct-pass" type="text" placeholder="deixe em branco para manter"/></div>
    <button class="btn ghost" onclick="savePass()">Alterar senha</button>
    <div class="section-title">Dados</div>
    <button class="btn danger" onclick="resetAll()">Apagar agendamentos e clientes</button>
    <div class="help" style="margin-top:10px">Remove todos os agendamentos e clientes cadastrados. Serviços, profissionais e configurações são mantidos.</div>`;
}
export async function saveContact(){
  const c=DB.config.contato;
  c.endereco=document.getElementById("ct-addr").value.trim();
  c.telefone=document.getElementById("ct-tel").value.trim();
  c.whatsapp=document.getElementById("ct-wa").value.replace(/\D/g,"");
  c.instagram=document.getElementById("ct-ig").value.trim();
  c.facebook=document.getElementById("ct-fb").value.trim();
  c.maps=document.getElementById("ct-maps").value.trim();
  await persistConfig(); toast("Contato atualizado.","ok");
}
export async function savePass(){
  const v=document.getElementById("ct-pass").value.trim();
  if(!v){ toast("Senha mantida.",""); return; }
  DB.config.adminPass=v; await persistConfig(); toast("Senha alterada.","ok");
}
export function resetAll(){
  confirmModal("Apagar agendamentos e clientes?","Esta ação não pode ser desfeita.",async()=>{
    try{ await repo.resetAll(); await repo.loadAll(); closeModal(); setTab("agenda"); toast("Dados removidos.","ok"); }
    catch(e){ console.error(e); toast("Erro ao apagar.","bad"); }
  });
}

/* ===================== Ações de agenda ===================== */
export function adminCancel(id){
  confirmModal("Cancelar agendamento?","O horário será liberado na agenda.",async()=>{
    try{ await repo.cancelBooking(id,"Cancelado pelo admin"); setTab("agenda"); toast("Agendamento cancelado.",""); }
    catch(e){ console.error(e); toast("Erro ao cancelar.","bad"); }
  });
}
export function adminReschedule(id){
  const b=DB.bookings.find(x=>x.id===id); if(!b) return;
  showModal("Reagendar",`
    <div class="grid2">
      <div class="field"><label>Nova data</label><input class="input" id="rs-date" type="date" min="${todayYMD()}" value="${b.date}"/></div>
      <div class="field"><label>Novo horário</label><input class="input" id="rs-time" type="time" value="${b.time}"/></div>
    </div>
    <button class="btn" onclick="saveReschedule('${id}')">Confirmar</button>`);
}
export async function saveReschedule(id){
  const b=DB.bookings.find(x=>x.id===id);
  const date=document.getElementById("rs-date").value, time=document.getElementById("rs-time").value;
  if(!date||!time){ toast("Preencha data e horário.","bad"); return; }
  const conflict=activeBookings(DB).some(x=>x.id!==id && x.date===date && (toMin(time)<toMin(x.time)+x.dur && toMin(time)+b.dur>toMin(x.time)));
  if(conflict){ toast("Conflito com outro agendamento.","bad"); return; }
  try{ await repo.rescheduleBooking(id,date,time); closeModal(); setTab("agenda"); toast("Reagendado.","ok"); }
  catch(e){ console.error(e); toast("Erro ao reagendar.","bad"); }
}

/* ===================== Exportações ===================== */
export function exportCSV(){
  const rows=[["Protocolo","Data","Hora","Servico","Profissional","Cliente","Telefone","Email","Valor","Status"]];
  DB.bookings.forEach(b=>rows.push([b.protocol,b.date,b.time,svcName(b.serviceId),barberName(b.barberId),
    b.client.name,b.client.phone,b.client.email||"",Number(b.price).toFixed(2),b.status]));
  const csv="\uFEFF"+rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(";")).join("\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="agenda-salao-marcola.csv"; a.click();
  toast("CSV exportado (abre no Excel).","ok");
}
export function exportPDF(){
  const rows=DB.bookings.filter(b=>b.status!=="cancelado").sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
  const html=`<html><head><meta charset="utf-8"><title>Agenda — Salão do Marcola</title>
    <style>body{font-family:Arial,sans-serif;padding:28px;color:#111}h1{font-size:22px}
    table{width:100%;border-collapse:collapse;margin-top:14px;font-size:13px}
    th,td{border:1px solid #ccc;padding:7px 9px;text-align:left}th{background:#111;color:#c8a24c}</style></head>
    <body><h1>Salão do Marcola — Agenda</h1><p>Gerado em ${new Date().toLocaleString("pt-BR")}</p>
    <table><thead><tr><th>Protocolo</th><th>Data</th><th>Hora</th><th>Serviço</th><th>Cliente</th><th>Telefone</th><th>Valor</th><th>Status</th></tr></thead><tbody>
    ${rows.map(b=>`<tr><td>${b.protocol}</td><td>${b.date}</td><td>${b.time}</td><td>${svcName(b.serviceId)}</td><td>${escapeHtml(b.client.name)}</td><td>${escapeHtml(b.client.phone)}</td><td>${money(b.price)}</td><td>${b.status}</td></tr>`).join("")}
    </tbody></table></body></html>`;
  const w=window.open("","_blank"); if(!w){ toast("Permita pop-ups para exportar PDF.","bad"); return; }
  w.document.write(html); w.document.close(); setTimeout(()=>w.print(),350);
}

/* ===================== Login do painel (ETAPA 1: senha no app) ===================== */
export function openAdmin(){
  if(sessionStorage.getItem("marcola_admin")==="1"){ go("admin"); return; }
  showModal("Acesso administrativo", `
    <div class="field"><label>Senha</label>
      <input class="input" id="admPass" type="password" placeholder="••••••••" />
      <div class="help">Senha padrão: <b>marcola123</b> (altere em Configurações).</div></div>
    <button class="btn" onclick="tryLogin()">Entrar</button>`);
  setTimeout(()=>{ const i=document.getElementById("admPass"); if(i){ i.focus(); i.onkeydown=e=>{ if(e.key==="Enter") tryLogin(); }; } },50);
}
export function tryLogin(){
  const v=document.getElementById("admPass").value;
  if(v===DB.config.adminPass){ sessionStorage.setItem("marcola_admin","1"); closeModal(); go("admin"); }
  else toast("Senha incorreta.","bad");
}
export function logoutAdmin(){ sessionStorage.removeItem("marcola_admin"); go("home"); }

/* ---------- util interno ---------- */
async function persistConfig(){
  try{ await repo.saveConfig(); }
  catch(e){ console.error(e); toast("Erro ao salvar configuração.","bad"); }
}
