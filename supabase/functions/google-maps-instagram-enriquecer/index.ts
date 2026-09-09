import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const APIFY_DIRECT = "https://api.apify.com/v2";
const APIFY_GATEWAY = "https://connector-gateway.lovable.dev/apify";
const ACTOR_ID = "apify~instagram-profile-scraper";
const CACHE_DIAS = 30;
const MAX_LEADS = 60;
const CONCORRENCIA = 3;

interface Body {
  busca_id?: string;
  lead_ids?: string[];
}

function getEnvOrThrow(name: string) {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Configuração ausente: ${name}`);
  return v;
}

const IGNORAR_SEGMENTOS = new Set([
  "p", "reel", "reels", "explore", "stories", "tv", "accounts", "about",
  "developer", "legal", "directory", "web", "graphql", "challenge", "s",
]);

/** Extrai o @usuário de uma URL do Instagram. Retorna null quando não é um perfil. */
export function usernameDoInstagram(url: string): string | null {
  const m = url.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  if (!m) return null;
  const user = m[1].toLowerCase();
  if (!user || IGNORAR_SEGMENTOS.has(user)) return null;
  if (user.length > 30) return null;
  return user;
}

/** Procura o primeiro link de perfil do Instagram no HTML de um site. */
export function acharInstagramNoHtml(html: string): { url: string; username: string } | null {
  const regex = /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9._/?=&-]*/gi;
  for (const bruto of html.match(regex) ?? []) {
    const limpo = bruto.replace(/["'<>\\]+$/g, "");
    const username = usernameDoInstagram(limpo);
    if (username) return { url: `https://www.instagram.com/${username}/`, username };
  }
  return null;
}

async function baixarHtml(site: string): Promise<string | null> {
  const url = /^https?:\/\//i.test(site) ? site : `https://${site}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MeusAcordosBot/1.0)",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return null;
    const tipo = res.headers.get("content-type") ?? "";
    if (tipo && !tipo.includes("html")) return null;
    const texto = await res.text();
    return texto.slice(0, 500_000);
  } catch (_e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

interface PerfilInstagram {
  seguidores: number | null;
  site: string | null;
  nome_completo: string | null;
  biografia: string | null;
  erro: string | null;
}

function apifyConfig() {
  const tokenDireto = (Deno.env.get("APIFY_API_TOKEN") ?? "").trim();
  if (tokenDireto) {
    return {
      base: APIFY_DIRECT,
      headers: { Authorization: `Bearer ${tokenDireto}`, "Content-Type": "application/json" },
    };
  }
  const lovable = (Deno.env.get("LOVABLE_API_KEY") ?? "").trim();
  const conexao = (Deno.env.get("APIFY_API_KEY") ?? "").trim();
  if (lovable && conexao) {
    return {
      base: APIFY_GATEWAY,
      headers: {
        Authorization: `Bearer ${lovable}`,
        "X-Connection-Api-Key": conexao,
        "Content-Type": "application/json",
      },
    };
  }
  return null;
}

async function buscarPerfil(
  username: string,
  cfg: { base: string; headers: Record<string, string> },
): Promise<PerfilInstagram> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    const res = await fetch(
      `${cfg.base}/acts/${ACTOR_ID}/run-sync-get-dataset-items?timeout=110&limit=1`,
      {
        method: "POST",
        headers: cfg.headers,
        signal: controller.signal,
        body: JSON.stringify({ usernames: [username], resultsLimit: 1 }),
      },
    );

    if (!res.ok) {
      const corpo = await res.text();
      console.error(`Apify falhou para @${username} [${res.status}]: ${corpo.slice(0, 500)}`);
      return { seguidores: null, site: null, nome_completo: null, biografia: null, erro: `apify_${res.status}` };
    }

    const itens = await res.json().catch(() => null);
    const item = Array.isArray(itens) ? itens[0] : itens;
    if (!item || item?.error) {
      return {
        seguidores: null,
        site: null,
        nome_completo: null,
        biografia: null,
        erro: String(item?.error ?? "perfil_nao_encontrado"),
      };
    }

    const seguidores = Number(item.followersCount ?? item.followers ?? NaN);
    return {
      seguidores: Number.isFinite(seguidores) ? seguidores : null,
      site: item.externalUrl ?? item.website ?? null,
      nome_completo: item.fullName ?? null,
      biografia: item.biography ?? null,
      erro: null,
    };
  } catch (e) {
    console.error(`Apify erro para @${username}:`, e);
    return { seguidores: null, site: null, nome_completo: null, biografia: null, erro: "timeout_ou_rede" };
  } finally {
    clearTimeout(timer);
  }
}

/** Roda tarefas com concorrência limitada. */
async function emLotes<T>(itens: T[], limite: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limite, Math.max(itens.length, 1)) }, async () => {
    while (i < itens.length) {
      const atual = itens[i++];
      await fn(atual);
    }
  });
  await Promise.all(workers);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = getEnvOrThrow("SUPABASE_URL");
    const serviceRoleKey = getEnvOrThrow("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = getEnvOrThrow("SUPABASE_ANON_KEY");
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization") ?? "";
    const apikeyHeader = req.headers.get("apikey") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const interno = token === serviceRoleKey || apikeyHeader === serviceRoleKey;

    if (!interno) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "Não autenticado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: pode } = await supabase.rpc("pode_google_maps_leads", { _user_id: user.id });
      if (!pode) {
        return new Response(JSON.stringify({ error: "Sem permissão para o Google Maps Leads" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    if (!body.busca_id && !body.lead_ids?.length) {
      return new Response(JSON.stringify({ error: "Informe busca_id ou lead_ids" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cfg = apifyConfig();

    // Leads candidatos: têm site e ainda não foram enriquecidos (ou estão vencidos)
    let query = supabase
      .from("google_maps_leads")
      .select("id, nome, site, instagram_url, instagram_username, instagram_atualizado_em")
      .limit(MAX_LEADS * 3);
    query = body.lead_ids?.length ? query.in("id", body.lead_ids) : query.eq("busca_id", body.busca_id!);

    const { data: leads, error: leadsErr } = await query;
    if (leadsErr) throw leadsErr;

    const limiteCache = Date.now() - CACHE_DIAS * 24 * 60 * 60 * 1000;
    const candidatos = (leads ?? [])
      .filter((l) => {
        const temFonte = !!(l.site || l.instagram_url);
        if (!temFonte) return false;
        if (!l.instagram_atualizado_em) return true;
        return new Date(l.instagram_atualizado_em).getTime() < limiteCache;
      })
      .slice(0, MAX_LEADS);

    if (!candidatos.length) {
      return new Response(
        JSON.stringify({ processados: 0, com_instagram: 0, chamadas_apify: 0, message: "Nada novo para enriquecer" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 1) Descobrir o Instagram lendo o site da empresa
    const achados = new Map<string, { url: string; username: string }>();
    await emLotes(candidatos, CONCORRENCIA, async (lead) => {
      const jaTem = lead.instagram_username ? { url: lead.instagram_url ?? `https://www.instagram.com/${lead.instagram_username}/`, username: lead.instagram_username } : null;
      if (jaTem) {
        achados.set(lead.id, jaTem);
        return;
      }
      const direto = lead.site ? usernameDoInstagram(lead.site) : null;
      if (direto) {
        achados.set(lead.id, { url: `https://www.instagram.com/${direto}/`, username: direto });
        return;
      }
      if (!lead.site) return;
      const html = await baixarHtml(lead.site);
      if (!html) return;
      const achado = acharInstagramNoHtml(html);
      if (achado) achados.set(lead.id, achado);
    });

    const usernames = Array.from(new Set(Array.from(achados.values()).map((a) => a.username)));

    // 2) Cache de perfis válido por 30 dias
    const perfis = new Map<string, PerfilInstagram>();
    const pendentes: string[] = [];
    if (usernames.length) {
      const { data: cache } = await supabase
        .from("instagram_perfil_cache")
        .select("username, seguidores, site, nome_completo, biografia, erro, atualizado_em")
        .in("username", usernames);
      const cacheMap = new Map((cache ?? []).map((c) => [c.username, c]));
      for (const u of usernames) {
        const c = cacheMap.get(u);
        if (c && new Date(c.atualizado_em).getTime() >= limiteCache) {
          perfis.set(u, {
            seguidores: c.seguidores ?? null,
            site: c.site ?? null,
            nome_completo: c.nome_completo ?? null,
            biografia: c.biografia ?? null,
            erro: c.erro ?? null,
          });
        } else {
          pendentes.push(u);
        }
      }
    }

    // 3) Buscar os perfis pendentes na Apify, respeitando o limite mensal
    let chamadas = 0;
    let bloqueadoPorLimite = false;
    let semApify = false;

    if (pendentes.length) {
      if (!cfg) {
        semApify = true;
      } else {
        const { data: statusUso } = await supabase.rpc("apify_status_uso");
        const st = Array.isArray(statusUso) ? statusUso[0] : statusUso;
        const disponivel = st ? Math.max(0, Number(st.limite) - Number(st.total_chamadas)) : pendentes.length;
        const permitidos = pendentes.slice(0, disponivel);
        if (permitidos.length < pendentes.length) bloqueadoPorLimite = true;

        await emLotes(permitidos, CONCORRENCIA, async (username) => {
          const perfil = await buscarPerfil(username, cfg);
          chamadas++;
          perfis.set(username, perfil);
          await supabase.from("instagram_perfil_cache").upsert({
            username,
            seguidores: perfil.seguidores,
            site: perfil.site,
            nome_completo: perfil.nome_completo,
            biografia: perfil.biografia,
            erro: perfil.erro,
            atualizado_em: new Date().toISOString(),
          });
        });

        if (chamadas > 0) await supabase.rpc("apify_incrementar_uso", { _qtd: chamadas });
      }
    }

    // 4) Gravar nos leads
    const agora = new Date().toISOString();
    let comInstagram = 0;
    let comSeguidores = 0;
    let semSeguidores = 0;
    let semSite = 0;
    for (const lead of candidatos) {
      const achado = achados.get(lead.id) ?? null;
      const perfil = achado ? perfis.get(achado.username) ?? null : null;
      if (achado) comInstagram++;
      if (!lead.site && !achado) semSite++;

      let status: string | null = null;
      if (!achado) {
        status = lead.site ? "sem_instagram_no_site" : "sem_site";
      } else if (typeof perfil?.seguidores === "number") {
        comSeguidores++;
      } else {
        semSeguidores++;
        const erro = (perfil?.erro ?? "").toLowerCase();
        if (!perfil) status = "seguidores_pendentes";
        else if (erro.includes("restrict") || erro.includes("private")) status = "perfil_restrito";
        else if (erro.includes("not_found") || erro.includes("nao_encontrado")) status = "perfil_nao_encontrado";
        else status = erro ? `erro:${erro.slice(0, 60)}` : "sem_seguidores";
      }

      await supabase
        .from("google_maps_leads")
        .update({
          instagram_url: achado?.url ?? null,
          instagram_username: achado?.username ?? null,
          instagram_seguidores: perfil?.seguidores ?? null,
          instagram_site: perfil?.site ?? null,
          instagram_status: status,
          instagram_atualizado_em: agora,
        })
        .eq("id", lead.id);
    }

    return new Response(
      JSON.stringify({
        processados: candidatos.length,
        com_instagram: comInstagram,
        com_seguidores: comSeguidores,
        sem_seguidores: semSeguidores,
        sem_site: semSite,
        chamadas_apify: chamadas,
        perfis_do_cache: Math.max(0, perfis.size - chamadas),
        limite_apify_atingido: bloqueadoPorLimite,
        apify_nao_configurada: semApify,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("google-maps-instagram-enriquecer erro:", err);
    return new Response(JSON.stringify({ error: String((err as Error)?.message ?? err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
