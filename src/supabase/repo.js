// Camada de acesso a dados (repositório). Nenhum outro arquivo fala com o
// Supabase diretamente — tudo passa por aqui. Faz o mapeamento entre as colunas
// do banco e o formato usado pelas telas (DB em state.js).
import { supabase, hasCredentials } from "./client.js";
import { DB } from "../state.js";
import { pad } from "../lib/format.js";
import { expired } from "../lib/slots.js";

/* ---------- Mapeamentos banco <-> app ---------- */
function rowToService(r){
  return { id:r.id, name:r.nome, price:Number(r.valor), dur:r.duracao,
           ordem:r.ordem, ativo:r.ativo, icon:r.icone || "✂️" };
}
function rowToBarber(r){
  return { id:r.id, name:r.nome, role:r.funcao, icon:r.icone || "💈", ordem:r.ordem, ativo:r.ativo };
}
function rowToBooking(r){
  const c = r.clientes || {};
  return {
    id:r.id, protocol:r.protocolo, serviceId:r.servico_id, barberId:r.barbeiro_id,
    clienteId:r.cliente_id, date:r.data, time:r.hora, dur:r.duracao, price:Number(r.valor),
    status:r.status, note:r.observacao || "",
    createdAt: r.criado_em ? new Date(r.criado_em).getTime() : Date.now(),
    paidAt: r.pago_em ? new Date(r.pago_em).getTime() : null,
    client: { name:c.nome||"", phone:c.telefone||"", email:c.email||"", notes:c.observacoes||"" },
  };
}

/* ---------- Carregamento inicial ---------- */
export async function loadAll(){
  if(!hasCredentials) throw new Error("SEM_CREDENCIAIS");

  const [cfg, svc, bar, agd] = await Promise.all([
    supabase.from("configuracoes").select("*").eq("id",1).single(),
    supabase.from("servicos").select("*").order("ordem",{ascending:true}),
    supabase.from("barbeiros").select("*").order("ordem",{ascending:true}),
    supabase.from("agendamentos").select("*, clientes(nome,telefone,email,observacoes)")
            .order("data",{ascending:true}),
  ]);
  for(const r of [cfg,svc,bar,agd]) if(r.error) throw r.error;

  const c = cfg.data;
  DB.config = {
    adminPass: c.admin_senha || "marcola123",
    slotStep:  c.slot_step || 40,
    theme:     c.tema || "dark",
    logo:      c.logo || "M",
    pix:     { recebedor:c.pix_nome||"", chave:c.pix_chave||"", banco:c.pix_banco||"", cidade:c.pix_cidade||"" },
    contato: { endereco:c.endereco||"", telefone:c.telefone||"", whatsapp:c.whatsapp||"",
               instagram:c.instagram||"", facebook:c.facebook||"", maps:c.google_maps||"" },
    horario_abertura: c.horario_abertura || "09:00",
    horario_fechamento: c.horario_fechamento || "19:00",
  };
  // horários por dia (jsonb). Se vazio, deriva de abertura/fechamento (seg–sáb).
  const h = c.horarios && Object.keys(c.horarios).length ? c.horarios : null;
  DB.hours = h || {
    0:{on:false,start:c.horario_abertura,end:c.horario_fechamento},
    1:{on:true,start:c.horario_abertura,end:c.horario_fechamento},
    2:{on:true,start:c.horario_abertura,end:c.horario_fechamento},
    3:{on:true,start:c.horario_abertura,end:c.horario_fechamento},
    4:{on:true,start:c.horario_abertura,end:c.horario_fechamento},
    5:{on:true,start:c.horario_abertura,end:c.horario_fechamento},
    6:{on:true,start:c.horario_abertura,end:c.horario_fechamento},
  };
  DB.blockedDates = Array.isArray(c.datas_bloqueadas) ? c.datas_bloqueadas : [];
  DB.blockedSlots = Array.isArray(c.horarios_bloqueados) ? c.horarios_bloqueados : [];

  DB.services = svc.data.map(rowToService);
  DB.barbers  = bar.data.map(rowToBarber);
  DB.bookings = agd.data.map(rowToBooking);

  await expireStalePending();
}

/* ---------- Configurações ---------- */
export async function saveConfig(){
  const c = DB.config;
  const row = {
    id:1,
    nome_empresa:"Salão do Marcola",
    endereco:c.contato.endereco, telefone:c.contato.telefone, whatsapp:c.contato.whatsapp,
    instagram:c.contato.instagram, facebook:c.contato.facebook, google_maps:c.contato.maps,
    pix_chave:c.pix.chave, pix_nome:c.pix.recebedor, pix_banco:c.pix.banco, pix_cidade:c.pix.cidade,
    logo:c.logo, horario_abertura:c.horario_abertura, horario_fechamento:c.horario_fechamento,
    horarios:DB.hours, datas_bloqueadas:DB.blockedDates, horarios_bloqueados:DB.blockedSlots,
    slot_step:c.slotStep, tema:c.theme, admin_senha:c.adminPass,
    atualizado_em:new Date().toISOString(),
  };
  const { error } = await supabase.from("configuracoes").update(row).eq("id",1);
  if(error) throw error;
}

/* ---------- Serviços ---------- */
export async function addService({name,price,dur,icon}){
  const ordem = (DB.services.reduce((m,s)=>Math.max(m,s.ordem||0),0)) + 1;
  const { data, error } = await supabase.from("servicos")
    .insert({ nome:name, valor:price, duracao:dur, icone:icon, ordem, ativo:true })
    .select().single();
  if(error) throw error;
  DB.services.push(rowToService(data));
}
export async function updateService(id,{name,price,dur,icon}){
  const { error } = await supabase.from("servicos")
    .update({ nome:name, valor:price, duracao:dur, icone:icon }).eq("id",id);
  if(error) throw error;
  Object.assign(DB.services.find(s=>s.id===id), {name,price,dur,icon});
}
export async function toggleService(id){
  const s = DB.services.find(x=>x.id===id);
  const { error } = await supabase.from("servicos").update({ ativo: !s.ativo }).eq("id",id);
  if(error) throw error;
  s.ativo = !s.ativo;
}
export async function deleteService(id){
  const { error } = await supabase.from("servicos").delete().eq("id",id);
  if(error) throw error;
  DB.services = DB.services.filter(s=>s.id!==id);
}
/** Recebe a nova ordem (array de ids) e grava o campo "ordem" de cada um. */
export async function reorderServices(orderedIds){
  const updates = orderedIds.map((id,i)=>({ id, ordem:i+1 }));
  await Promise.all(updates.map(u =>
    supabase.from("servicos").update({ ordem:u.ordem }).eq("id",u.id)
  ));
  updates.forEach(u => { const s=DB.services.find(x=>x.id===u.id); if(s) s.ordem=u.ordem; });
  DB.services.sort((a,b)=>(a.ordem||0)-(b.ordem||0));
}

/* ---------- Barbeiros ---------- */
export async function addBarber({name,role,icon}){
  const ordem = (DB.barbers.reduce((m,b)=>Math.max(m,b.ordem||0),0)) + 1;
  const { data, error } = await supabase.from("barbeiros")
    .insert({ nome:name, funcao:role, icone:icon, ordem, ativo:true }).select().single();
  if(error) throw error;
  DB.barbers.push(rowToBarber(data));
}
export async function updateBarber(id,{name,role,icon}){
  const { error } = await supabase.from("barbeiros").update({ nome:name, funcao:role, icone:icon }).eq("id",id);
  if(error) throw error;
  Object.assign(DB.barbers.find(b=>b.id===id), {name,role,icon});
}
export async function deleteBarber(id){
  const { error } = await supabase.from("barbeiros").delete().eq("id",id);
  if(error) throw error;
  DB.barbers = DB.barbers.filter(b=>b.id!==id);
}

/* ---------- Clientes ---------- */
async function upsertClient(client){
  const { data, error } = await supabase.from("clientes")
    .upsert({ nome:client.name, telefone:client.phone, email:client.email||"", observacoes:client.notes||"" },
            { onConflict:"telefone" })
    .select().single();
  if(error) throw error;
  return data.id;
}

/* ---------- Agendamentos ---------- */
async function nextProtocol(){
  const { count } = await supabase.from("agendamentos").select("*",{count:"exact",head:true});
  const n = String((count||0)+1).padStart(4,"0");
  return "MAR-" + new Date().getFullYear() + "-" + n;
}

export async function createBooking(flow){
  const clienteId = await upsertClient(flow.client);
  let protocol = await nextProtocol();
  const base = {
    protocolo:protocol, servico_id:flow.service.id, barbeiro_id:flow.barber.id, cliente_id:clienteId,
    data:flow.date, hora:flow.time, duracao:flow.service.dur, valor:flow.service.price, status:"pendente",
  };
  let { data, error } = await supabase.from("agendamentos").insert(base).select().single();
  // colisão de protocolo: tenta de novo com sufixo aleatório
  if(error && String(error.message||"").includes("protocolo")){
    base.protocolo = protocol + "-" + Math.random().toString(36).slice(2,5).toUpperCase();
    ({ data, error } = await supabase.from("agendamentos").insert(base).select().single());
  }
  if(error){
    // índice único de slot => horário acabou de ser reservado
    if(String(error.code)==="23505") { const e=new Error("SLOT_OCUPADO"); e.code="SLOT_OCUPADO"; throw e; }
    throw error;
  }
  const b = rowToBooking({ ...data, clientes:{ nome:flow.client.name, telefone:flow.client.phone, email:flow.client.email, observacoes:flow.client.notes } });
  DB.bookings.push(b);
  return b;
}

export async function confirmBooking(id){
  const { error } = await supabase.from("agendamentos")
    .update({ status:"confirmado", pago_em:new Date().toISOString() }).eq("id",id);
  if(error) throw error;
  const b = DB.bookings.find(x=>x.id===id); if(b){ b.status="confirmado"; b.paidAt=Date.now(); }
}
export async function cancelBooking(id, note){
  const { error } = await supabase.from("agendamentos")
    .update({ status:"cancelado", observacao:note||"" }).eq("id",id);
  if(error) throw error;
  const b = DB.bookings.find(x=>x.id===id); if(b){ b.status="cancelado"; b.note=note||""; }
}
export async function rescheduleBooking(id, date, time){
  const { error } = await supabase.from("agendamentos").update({ data:date, hora:time }).eq("id",id);
  if(error) throw error;
  const b = DB.bookings.find(x=>x.id===id); if(b){ b.date=date; b.time=time; }
}

/** Marca como cancelado todo pendente que passou dos 15 min sem pagamento. */
export async function expireStalePending(){
  const stale = DB.bookings.filter(b => expired(b));
  for(const b of stale){
    await supabase.from("agendamentos").update({ status:"cancelado", observacao:"Expirado (pagamento não confirmado)" }).eq("id",b.id);
    b.status="cancelado"; b.note="Expirado";
  }
}

/* ---------- Reset (apaga tudo e recria o seed do schema) ---------- */
export async function resetAll(){
  await supabase.from("agendamentos").delete().neq("id","00000000-0000-0000-0000-000000000000");
  await supabase.from("clientes").delete().neq("id","00000000-0000-0000-0000-000000000000");
  // serviços/barbeiros/config voltam a ser populados rodando o seed do schema.sql novamente.
}
