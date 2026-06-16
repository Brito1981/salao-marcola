// Estado em memória da sessão.
// IMPORTANTE: NÃO é fonte de verdade — é apenas um cache do que vem do Supabase.
// Tudo é (re)carregado de loadAll() e toda alteração é gravada no banco pela camada repo.
// O formato espelha o protótipo para preservar 100% das telas/UX.

export const DB = {
  config: {
    adminPass: "",
    slotStep: 40,
    theme: "dark",
    logo: "M",
    pix:     { recebedor:"", chave:"", banco:"", cidade:"" },
    contato: { endereco:"", telefone:"", whatsapp:"", instagram:"", facebook:"", maps:"" },
    horario_abertura: "09:00",
    horario_fechamento: "19:00",
  },
  hours: {},            // { 0..6: {on,start,end} }
  blockedDates: [],     // ["2026-06-20", ...]
  blockedSlots: [],     // [{date,time}]
  services: [],         // [{id,name,price,dur,icon,ordem,ativo}]
  barbers: [],          // [{id,name,role,icon}]
  bookings: [],         // [{id,protocol,serviceId,barberId,date,time,dur,price,client{},status,createdAt,paidAt}]
};

// Fluxo do agendamento (efêmero — só durante a jornada do cliente)
export const flow = {
  service:null, barber:null, date:null, time:null,
  client:{}, pendingId:null, holdTimer:null, holdUntil:0,
};

export const ui = {
  calMonth: (() => { const d=new Date(); d.setDate(1); return d; })(),
  adminTab: "dash",
};

// Apenas serviços ativos aparecem para o cliente (ordenados por "ordem")
export function publicServices(){
  return DB.services.filter(s => s.ativo).sort((a,b)=>(a.ordem||0)-(b.ordem||0));
}

export function svcName(id){ const x=DB.services.find(s=>s.id===id); return x?x.name:"Serviço"; }
export function barberName(id){ const x=DB.barbers.find(b=>b.id===id); return x?x.name:"Profissional"; }
