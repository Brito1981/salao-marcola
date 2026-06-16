// Funções utilitárias de formatação, datas e texto.

export const WD   = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
export const WD_S = ["dom","seg","ter","qua","qui","sex","sáb"];
export const MES  = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

export function sid(){ return Math.random().toString(36).slice(2,9); }
export function money(v){ return "R$ " + Number(v).toFixed(2).replace(".",","); }
export function pad(n){ return String(n).padStart(2,"0"); }

export function ymd(d){ return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate()); }
export function parseYMD(str){ const [y,m,dd]=str.split("-").map(Number); return new Date(y,m-1,dd); }
export function fmtDateLong(str){ const d=parseYMD(str); return `${WD[d.getDay()]}, ${d.getDate()} de ${MES[d.getMonth()]}`; }
export function todayYMD(){ return ymd(new Date()); }

export function toMin(t){ const [h,m]=t.split(":").map(Number); return h*60+m; }
export function toHHMM(min){ return pad(Math.floor(min/60))+":"+pad(min%60); }

export function escapeHtml(str){
  return String(str==null?"":str).replace(/[&<>"']/g, c => (
    {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]
  ));
}
