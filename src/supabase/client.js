// Inicialização do cliente Supabase.
// As credenciais vêm SOMENTE de variáveis de ambiente (nada fixo no código):
//   - VITE_SUPABASE_URL
//   - VITE_SUPABASE_ANON_KEY
// Local: arquivo ".env" na raiz.  Produção (Netlify): Site settings > Environment variables.
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasCredentials = Boolean(url && anon);

if(!hasCredentials){
  console.error(
    "[Salão do Marcola] Faltam as variáveis VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY.\n"+
    "Defina-as no arquivo .env (local) ou nas Environment variables da Netlify."
  );
}

// Se faltar credencial, cria um client "vazio" só para não quebrar o import;
// a tela mostrará um aviso amigável (ver main.js).
export const supabase = hasCredentials
  ? createClient(url, anon, { auth: { persistSession: false } })
  : null;
