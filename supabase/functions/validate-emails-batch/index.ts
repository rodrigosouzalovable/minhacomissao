// Validador de e-mails em lote (grátis): sintaxe + domínio descartável + typo + MX lookup via DNS-over-HTTPS.
// Sem persistência. Apenas admin pode chamar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com","10minutemail.com","10minutemail.net","tempmail.com","temp-mail.org","temp-mail.io",
  "guerrillamail.com","guerrillamail.net","guerrillamail.org","guerrillamail.biz","guerrillamail.de",
  "sharklasers.com","grr.la","yopmail.com","yopmail.net","yopmail.fr","trashmail.com","trashmail.net",
  "throwawaymail.com","getnada.com","nada.email","mintemail.com","mohmal.com","fakeinbox.com",
  "tempinbox.com","tempmailaddress.com","tempmail.plus","spam4.me","spambox.us","spambog.com",
  "dispostable.com","mailnesia.com","maildrop.cc","mailnull.com","emailondeck.com","mailcatch.com",
  "moakt.com","wegwerfemail.de","mailtemp.info","emailtemporanea.com","temp-mail.ru","fakemail.net",
  "anonbox.net","mytemp.email","tmail.ws","tmpmail.org","tmpmail.net","mvrht.net","mvrht.com",
  "burnermail.io","mailpoof.com","incognitomail.com","incognitomail.org","mailcuk.com","mailde.de",
  "mail.tm","mail-temp.com","mailgw.com","minuteinbox.com","throwam.com","trashinbox.com",
  "yopmail.gq","yopmail.com.br","mailinator.net","mailinator.org","sogetthis.com","spam.la",
  "tempr.email","mail.bccto.me","jetable.org","jnxjn.com","correo.blogos.net","cek.pm",
]);

const TYPO_FIXES: Record<string, string> = {
  "gmial.com":"gmail.com","gmai.com":"gmail.com","gnail.com":"gmail.com","gmali.com":"gmail.com",
  "gmail.con":"gmail.com","gmail.co":"gmail.com","gmail.cm":"gmail.com","gmail.om":"gmail.com",
  "gmaill.com":"gmail.com","gmail.comm":"gmail.com","gmal.com":"gmail.com","gemail.com":"gmail.com",
  "hotmial.com":"hotmail.com","hotmai.com":"hotmail.com","hotmal.com":"hotmail.com",
  "hotmail.con":"hotmail.com","hotmail.co":"hotmail.com","hotmail.cm":"hotmail.com",
  "hotmaill.com":"hotmail.com","hormail.com":"hotmail.com","hotnail.com":"hotmail.com",
  "homtail.com":"hotmail.com","hotmail.com.br.com":"hotmail.com.br","hotmial.com.br":"hotmail.com.br",
  "outloook.com":"outlook.com","outlok.com":"outlook.com","outlook.con":"outlook.com",
  "outllok.com":"outlook.com","outlook.co":"outlook.com","oultlook.com":"outlook.com",
  "yaho.com":"yahoo.com","yaho.com.br":"yahoo.com.br","yahoo.con":"yahoo.com","yahho.com":"yahoo.com",
  "yhoo.com":"yahoo.com","yahooo.com":"yahoo.com","yaoo.com":"yahoo.com",
  "uol.com":"uol.com.br","uolmail.com":"uol.com.br","bol.com":"bol.com.br","ig.com":"ig.com.br",
  "terra.com":"terra.com.br","globo.com.br.com":"globo.com",
  "icloud.con":"icloud.com","iclod.com":"icloud.com","icloud.co":"icloud.com",
  "live.con":"live.com","live.co":"live.com",
};

const ROLE_BASED = new Set([
  "contato","contact","admin","administrador","suporte","support","ajuda","help","sac","atendimento",
  "vendas","sales","comercial","marketing","financeiro","compras","rh","cobranca","cobrança",
  "noreply","no-reply","naoresponda","nao-responda","postmaster","webmaster","info","contact",
]);

// RFC 5322 simplificado (suficiente pra triagem).
const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

type Status = "valido" | "invalido" | "duvidoso";
type Result = { email: string; status: Status; motivo: string; sugestao?: string };

const mxCache = new Map<string, boolean>();

async function lookupMx(domain: string): Promise<boolean> {
  const cached = mxCache.get(domain);
  if (cached !== undefined) return cached;

  const tryEndpoint = async (url: string): Promise<boolean | null> => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3500);
      const res = await fetch(url, {
        headers: { accept: "application/dns-json" },
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!res.ok) return null;
      const data = await res.json();
      // Status 0 = NOERROR; Answer with MX records.
      if (data?.Status === 0 && Array.isArray(data?.Answer) && data.Answer.length > 0) return true;
      // NOERROR sem Answer → sem MX. NXDOMAIN (Status 3) → sem MX.
      if (data?.Status === 0 || data?.Status === 3) return false;
      return null;
    } catch { return null; }
  };

  let result = await tryEndpoint(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`);
  if (result === null) {
    result = await tryEndpoint(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`);
  }
  // Fallback: se ambos DNS falharam, considera duvidoso → retorna true (não bloqueia).
  const final = result === null ? true : result;
  mxCache.set(domain, final);
  return final;
}

async function classify(emailRaw: string): Promise<Result> {
  const email = (emailRaw ?? "").trim().toLowerCase();
  if (!email) return { email: emailRaw, status: "invalido", motivo: "Vazio" };
  if (!EMAIL_RE.test(email)) return { email, status: "invalido", motivo: "Sintaxe inválida" };

  const [local, domain] = email.split("@");
  if (!local || !domain) return { email, status: "invalido", motivo: "Sintaxe inválida" };

  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { email, status: "invalido", motivo: "Domínio descartável/temporário" };
  }

  const typoFix = TYPO_FIXES[domain];
  if (typoFix) {
    return {
      email, status: "invalido",
      motivo: `Domínio com erro de digitação (sugestão: ${typoFix})`,
      sugestao: `${local}@${typoFix}`,
    };
  }

  const hasMx = await lookupMx(domain);
  if (!hasMx) return { email, status: "invalido", motivo: "Domínio sem servidor de e-mail (sem MX)" };

  if (ROLE_BASED.has(local)) {
    return { email, status: "duvidoso", motivo: "E-mail genérico/role-based" };
  }

  return { email, status: "valido", motivo: "OK" };
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = idx++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Acesso negado: somente admin" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const emails = Array.isArray(body?.emails) ? body.emails : null;
    if (!emails || emails.length === 0) {
      return new Response(JSON.stringify({ error: "Lista de e-mails vazia" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (emails.length > 500) {
      return new Response(JSON.stringify({ error: "Máximo 500 e-mails por lote" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = await mapWithConcurrency(emails as string[], 20, classify);

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
