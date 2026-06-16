// Geração de links externos: Google Agenda, arquivo .ics e WhatsApp.
import { pad, parseYMD, fmtDateLong, money } from "./format.js";

function gcalDates(dateStr, time, dur){
  const d = parseYMD(dateStr); const [h,m]=time.split(":").map(Number);
  const start = new Date(d); start.setHours(h,m,0,0);
  const end = new Date(start.getTime()+dur*60000);
  const f = x => x.getUTCFullYear()+pad(x.getUTCMonth()+1)+pad(x.getUTCDate())
    +"T"+pad(x.getUTCHours())+pad(x.getUTCMinutes())+"00Z";
  return f(start)+"/"+f(end);
}

export function gcalLink(DB, b, svcName, barberName){
  const svc = svcName(b.serviceId);
  const u = new URL("https://calendar.google.com/calendar/render");
  u.searchParams.set("action","TEMPLATE");
  u.searchParams.set("text", `${svc} — Salão do Marcola`);
  u.searchParams.set("dates", gcalDates(b.date,b.time,b.dur));
  u.searchParams.set("details", `Protocolo ${b.protocol}\nProfissional: ${barberName(b.barberId)}\n${DB.config.contato.endereco}`);
  u.searchParams.set("location", DB.config.contato.endereco);
  return u.toString();
}

export function icsFile(DB, b, svcName){
  const svc = svcName(b.serviceId); const d = parseYMD(b.date); const [h,m]=b.time.split(":").map(Number);
  const start = new Date(d); start.setHours(h,m,0,0); const end = new Date(start.getTime()+b.dur*60000);
  const f = x => x.getFullYear()+pad(x.getMonth()+1)+pad(x.getDate())+"T"+pad(x.getHours())+pad(x.getMinutes())+"00";
  const ics = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Salao do Marcola//PT-BR","BEGIN:VEVENT",
    "UID:"+b.id+"@salaodomarcola","DTSTAMP:"+f(new Date()),"DTSTART:"+f(start),"DTEND:"+f(end),
    "SUMMARY:"+svc+" - Salao do Marcola","LOCATION:"+(DB.config.contato.endereco||"").replace(/\n/g," "),
    "DESCRIPTION:Protocolo "+b.protocol,"END:VEVENT","END:VCALENDAR"].join("\r\n");
  const blob = new Blob([ics],{type:"text/calendar"});
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = "agendamento-"+b.protocol+".ics"; a.click();
}

export function waConfirmLink(DB, b, svcName, barberName){
  const msg = `Olá! Confirmo meu agendamento no *Salão do Marcola* ✂️\n\n`+
    `📋 Protocolo: ${b.protocol}\n💈 Serviço: ${svcName(b.serviceId)}\n👤 Profissional: ${barberName(b.barberId)}\n`+
    `📅 ${fmtDateLong(b.date)}\n🕐 ${b.time}\n💰 ${money(b.price)}`;
  return "https://wa.me/"+DB.config.contato.whatsapp+"?text="+encodeURIComponent(msg);
}
