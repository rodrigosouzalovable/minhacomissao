// Detecta chips de aquecimento sem foto/nome real/sobre e aplica automaticamente:
// - Foto: logo Souza & Ribeiro / Novo Mundo (URL pública do bucket)
// - Nome: sorteado de pool natural (sem "WhatsApp 02" etc.)
// - Sobre: sorteado de pool de bios da empresa
//
// Anti-ban: 20-40s entre instâncias, no máx. 6 chips por execução,
// só atua em chips com idade >= 5d e nunca repete a mesma ação no mesmo chip.
// Cron: diário em horário comercial.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_POR_EXECUCAO = 6;
const DELAY_MIN_MS = 20_000;
const DELAY_MAX_MS = 40_000;
const IDADE_MIN_DIAS = 5;

const NOMES_GENERICOS_REGEX = /^(whatsapp|user|usuario|usuário|chip|aquec|teste|test)\s*\d*$/i;

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function uazFetch(serverUrl: string, token: string, path: string, body: any) {
  const base = serverUrl.replace(/\/+$/, "");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const txt = await res.text();
    let json: any = null;
    try { json = JSON.parse(txt); } catch { /* ignore */ }
    return { ok: res.ok, status: res.status, txt, json };
  } catch (e) {
    return { ok: false, status: 0, txt: String(e), json: null };
  } finally {
    clearTimeout(t);
  }
}

// Tenta múltiplos endpoints UAZAPI conhecidos (varia entre versões).
async function getProfile(serverUrl: string, token: string) {
  const base = serverUrl.replace(/\/+$/, "");
  for (const path of ["/instance/me", "/instance/profile", "/instance/getProfile", "/instance/getme"]) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15_000);
      const res = await fetch(`${base}${path}`, { headers: { token }, signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) continue;
      const json = await res.json().catch(() => null);
      if (!json) continue;
      // Normaliza
      const name = json.name || json.pushName || json.profileName || json.nome || json?.profile?.name || null;
      const status = json.status || json.about || json.bio || json?.profile?.status || null;
      const picture = json.picture || json.profilePicture || json.image || json.imgUrl || json?.profile?.picture || null;
      return { ok: true, name, status, picture, raw: json };
    } catch { /* try next */ }
  }
  return { ok: false, name: null, status: null, picture: null, raw: null };
}

async function setProfilePicture(serverUrl: string, token: string, imageUrl: string) {
  // UAZAPI tipicamente aceita URL no campo "image"
  for (const path of ["/instance/updateProfilePicture", "/instance/setProfilePicture", "/profile/updatePicture"]) {
    const r = await uazFetch(serverUrl, token, path, { image: imageUrl, url: imageUrl });
    if (r.ok) return r;
  }
  return { ok: false, status: 0, txt: "todos endpoints falharam", json: null };
}

async function setProfileName(serverUrl: string, token: string, name: string) {
  for (const path of ["/instance/updateProfileName", "/instance/setProfileName", "/profile/updateName"]) {
    const r = await uazFetch(serverUrl, token, path, { name });
    if (r.ok) return r;
  }
  return { ok: false, status: 0, txt: "todos endpoints falharam", json: null };
}

async function setProfileStatus(serverUrl: string, token: string, status: string) {
  for (const path of ["/instance/updateProfileStatus", "/instance/setProfileStatus", "/profile/updateStatus"]) {
    const r = await uazFetch(serverUrl, token, path, { status, text: status });
    if (r.ok) return r;
  }
  return { ok: false, status: 0, txt: "todos endpoints falharam", json: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body: any = await req.json().catch(() => ({}));
    const dryRun: boolean = !!body?.dry_run;
    const forceInstanceIds: string[] = Array.isArray(body?.instance_ids) ? body.instance_ids : [];

    // Configs
    const { data: cfgRows } = await supabase
      .from("whatsapp_aquecimento_config")
      .select("chave, valor")
      .in("chave", ["perfil_completacao_ativo", "perfil_foto_url", "perfil_nome_pool", "perfil_sobre_pool"]);
    const cfg: Record<string, any> = {};
    (cfgRows || []).forEach((r: any) => { cfg[r.chave] = r.valor; });

    const ativo = cfg.perfil_completacao_ativo;
    if (ativo === false || ativo === "false") {
      return json({ message: "Completação de perfil desativada" });
    }

    const fotoUrl: string = typeof cfg.perfil_foto_url === "string" ? cfg.perfil_foto_url : (cfg.perfil_foto_url ?? "");
    const nomePool: string[] = Array.isArray(cfg.perfil_nome_pool) ? cfg.perfil_nome_pool : [];
    const sobrePool: string[] = Array.isArray(cfg.perfil_sobre_pool) ? cfg.perfil_sobre_pool : [];

    if (!fotoUrl || nomePool.length === 0 || sobrePool.length === 0) {
      return json({ error: "Configuração incompleta (foto/nome/sobre pool)" }, 500);
    }

    // Instâncias candidatas: warming ativo OU forçadas
    let query = supabase
      .from("user_whatsapp_instances")
      .select("id, nome, server_url, instance_token, criado_em, ativo, user_id")
      .eq("ativo", true);
    if (forceInstanceIds.length > 0) query = query.in("id", forceInstanceIds);
    const { data: instances } = await query;

    if (!instances || instances.length === 0) {
      return json({ message: "Sem instâncias elegíveis" });
    }

    // Idade >= 5d (pula esse filtro se foi forçado)
    const elegiveis = instances.filter((i: any) => {
      if (forceInstanceIds.includes(i.id)) return true;
      const idade = (Date.now() - new Date(i.criado_em).getTime()) / 86_400_000;
      return idade >= IDADE_MIN_DIAS;
    });

    // Embaralha e limita
    const shuffled = elegiveis.sort(() => Math.random() - 0.5).slice(0, MAX_POR_EXECUCAO);

    const results: any[] = [];

    for (const inst of shuffled) {
      const log = (acao: string, valor: string | null, status: "sucesso" | "erro" | "skip", erro?: string) => {
        if (dryRun) return;
        return supabase.from("whatsapp_perfil_completacao_log").insert({
          instancia_id: inst.id, acao, valor_aplicado: valor, status, erro: erro ?? null,
        });
      };

      try {
        const prof = await getProfile(inst.server_url, inst.instance_token);
        const acoes: any = { instancia: inst.nome, foto: null, nome: null, sobre: null };

        const semFoto = !prof.picture || prof.picture === "" || /no.*image|placeholder/i.test(String(prof.picture));
        const nomeAtual = (prof.name || "").toString().trim();
        const semNomeReal = !nomeAtual || NOMES_GENERICOS_REGEX.test(nomeAtual);
        const semSobre = !prof.status || String(prof.status).trim() === "";

        // FOTO
        if (semFoto) {
          if (dryRun) {
            acoes.foto = "WOULD_SET";
          } else {
            const r = await setProfilePicture(inst.server_url, inst.instance_token, fotoUrl);
            acoes.foto = r.ok ? "OK" : `ERRO ${r.status}`;
            await log("foto", fotoUrl, r.ok ? "sucesso" : "erro", r.ok ? undefined : r.txt.substring(0, 300));
          }
          await new Promise((r) => setTimeout(r, 4000 + Math.random() * 4000));
        } else {
          acoes.foto = "JA_TEM";
        }

        // NOME
        if (semNomeReal) {
          const novoNome = pickRandom(nomePool);
          if (dryRun) {
            acoes.nome = `WOULD_SET: ${novoNome}`;
          } else {
            const r = await setProfileName(inst.server_url, inst.instance_token, novoNome);
            acoes.nome = r.ok ? `OK: ${novoNome}` : `ERRO ${r.status}`;
            await log("nome", novoNome, r.ok ? "sucesso" : "erro", r.ok ? undefined : r.txt.substring(0, 300));
          }
          await new Promise((r) => setTimeout(r, 4000 + Math.random() * 4000));
        } else {
          acoes.nome = `JA_TEM: ${nomeAtual}`;
        }

        // SOBRE
        if (semSobre) {
          const novoSobre = pickRandom(sobrePool);
          if (dryRun) {
            acoes.sobre = `WOULD_SET: ${novoSobre}`;
          } else {
            const r = await setProfileStatus(inst.server_url, inst.instance_token, novoSobre);
            acoes.sobre = r.ok ? `OK: ${novoSobre}` : `ERRO ${r.status}`;
            await log("sobre", novoSobre, r.ok ? "sucesso" : "erro", r.ok ? undefined : r.txt.substring(0, 300));
          }
        } else {
          acoes.sobre = "JA_TEM";
        }

        results.push(acoes);
      } catch (e) {
        results.push({ instancia: inst.nome, erro: String(e) });
      }

      // Anti-ban entre instâncias
      const wait = DELAY_MIN_MS + Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS);
      await new Promise((r) => setTimeout(r, wait));
    }

    return json({ success: true, processadas: results.length, dry_run: dryRun, results });
  } catch (e) {
    console.error("[PERFIL_COMPLETAR] erro:", e);
    return json({ error: String(e) }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
