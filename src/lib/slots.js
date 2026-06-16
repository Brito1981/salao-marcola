// Regras de disponibilidade: grade de horários, anti-duplicidade e expiração.
import { toMin, toHHMM, parseYMD, todayYMD } from "./format.js";

/** Reserva pendente sem pagamento há mais de 15 min é considerada expirada. */
export function expired(b){
  return b.status === "pendente" && (Date.now() - b.createdAt) > 15*60*1000;
}

/** Agendamentos que efetivamente ocupam a agenda (ignora cancelados e pendentes expirados). */
export function activeBookings(DB){
  return DB.bookings.filter(b => b.status !== "cancelado" && !expired(b));
}

/** Lista os horários do dia para um serviço, marcando quais estão livres. */
export function freeSlots(DB, dateStr, dur){
  const d = parseYMD(dateStr);
  const h = DB.hours[d.getDay()];
  if(!h || !h.on) return [];
  if(DB.blockedDates.includes(dateStr)) return [];

  const open = toMin(h.start), close = toMin(h.end);
  const step = DB.config.slotStep || 40;
  const taken = activeBookings(DB).filter(b => b.date===dateStr)
    .map(b => ({ s: toMin(b.time), e: toMin(b.time)+b.dur }));
  const blocked = DB.blockedSlots.filter(x => x.date===dateStr).map(x => toMin(x.time));
  const nowMin = (dateStr===todayYMD())
    ? (new Date().getHours()*60 + new Date().getMinutes()) : -1;

  const out = [];
  for(let t=open; t+dur<=close; t+=step){
    if(t < nowMin) continue;
    const end = t+dur;
    const conflict = taken.some(b => t < b.e && end > b.s) || blocked.includes(t);
    out.push({ time: toHHMM(t), free: !conflict });
  }
  return out;
}

export function dateHasAvailability(DB, dateStr, service){
  const dur = service ? service.dur : (DB.config.slotStep || 40);
  return freeSlots(DB, dateStr, dur).some(x => x.free);
}
