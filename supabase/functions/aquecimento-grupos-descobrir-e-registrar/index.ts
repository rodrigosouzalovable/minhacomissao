// Descobre grupos no WhatsApp via UAZAPI e registra em whatsapp_aquecimento_grupos
// junto com membros (matched por sufixo de 8 dígitos do telefone) + config default.
//
// Body: { name_contains?: string = "Família Souza e Ribeiro" }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function suffix8(phone: string | null | undefined): string {
  if (!phone) return "";
  const d = String(phone).replace(/\D/g, "");
  return d.slice(-8);
}

function normalizeGroup(g: any) {
  const jid = g?.JID || g?.jid || g?.id || g?.groupJid || g?.group_id || g?.remoteJid || g?.chatId || "";
  const nome = g?.Name || g?.name || g?.subject || g?.Subject || g?.nome || g?.groupName || g?.title || "";
  const participants = g?.Participants || g?.participants || g?.members || [];
  return { jid: String(jid || ""), nome: String(nome || ""), participants };
}

function extractGroupArray(parsed: any): any[] {
  if (!parsed) return [];
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.groups)) return parsed.groups;
  if (Array.isArray(parsed?.data)) return parsed.data;
  if (Array.isArray(parsed?.result)) return parsed.result;
  if (Array.isArray(parsed?.response)) return parsed.response;
  if (Array.isArray(parsed?.chats)) return parsed.chats.filter((c: any) => String(c?.id || c?.jid || "").endsWith("@g.us"));
  return [];
}

async function fetchGroupParticipants(serverUrl: string, token: string, groupJid: string): Promise<any[]> {
  const base = serverUrl.replace(/\/+$/, "");
  const headers = { token, "Content-Type": "application/json" };
  const attempts = [
    { url: `${base}/group/info`, method: "POST", body: JSON.stringify({ groupjid: groupJid }) },
    { url: `${base}/group/info?groupjid=${encodeURIComponent(groupJid)}`, method: "GET" },
    { url: `${base}/group/getParticipants`, method: "POST", body: JSON.stringify({ groupjid: groupJid }) },
  ];
  for (const a of attempts) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(a.url, { method: a.method, headers, body: (a as any).body, signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) continue;
      const txt = await res.text();
      const j = JSON.parse(txt);
      const parts = j?.Participants || j?.participants || j?.group?.participants || j?.data?.participants || [];
      if (Array.isArray(parts) && parts.length > 0) return parts;
    } catch { /* try next */ }
  }
  return [];
}

async function fetchGroups(serverUrl: string, token: string): Promise<any[]> {
  const base = serverUrl.replace(/\/+$/, "");
  const attempts = [
    { method: "POST", path: "/group/list", body: { force: true } },
    { method: "GET", path: "/group/list?force=true" },
    { method: "GET", path: "/group/list" },
    { method: "POST", path: "/group/list", body: {} },
  ];
  for (const a of attempts) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 20000);
      const init: RequestInit = {
        method: a.method,
        headers: { token, "Content-Type": "application/json" },
        signal: ctrl.signal,
      };
      if (a.method === "POST") init.body = JSON.stringify((a as any).body || {});
      const res = await fetch(`${base}${a.path}`, init);
      clearTimeout(t);
      const text = await res.text();
      if (!res.ok) continue;
      const lower = text.toLowerCase();
      if (lower.includes("disconnected") || lower.includes("not connected")) return [];
      let parsed: any; try { parsed = JSON.parse(text); } catch { continue; }
      const arr = extractGroupArray(parsed);
      if (arr.length > 0) return arr;
    } catch { /* try next */ }
  }
  return [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const namePattern = String(body?.name_contains || "Família Souza e Ribeiro").toLowerCase();

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: instancias, error: errInst } = await supa
      .from("user_whatsapp_instances")
      .select("id, nome, server_url, instance_token, telefone, ativo")
      .eq("ativo", true);
    if (errInst) throw errInst;

    // sufixo -> instancia (telefone OU dígitos extraídos do nome)
    const sufToInst = new Map<string, { id: string; nome: string }>();
    for (const i of instancias || []) {
      const candidatos: string[] = [];
      if (i.telefone) candidatos.push(String(i.telefone));
      // extrai todas as sequências de dígitos com 10+ no nome
      const matches = String(i.nome || "").match(/\d{10,}/g) || [];
      candidatos.push(...matches);
      // também tenta padrão (62)98245-8554
      const compact = String(i.nome || "").replace(/\D/g, "");
      if (compact.length >= 10) candidatos.push(compact);
      for (const c of candidatos) {
        const s = suffix8(c);
        if (s && !sufToInst.has(s)) sufToInst.set(s, { id: i.id, nome: i.nome || "" });
      }
    }

    // jid -> { nome, participants_set, first_finder_inst_id }
    const grupos = new Map<string, { nome: string; participantes: Set<string>; admin_inst_id: string }>();

    // Limita paralelismo
    const CHUNK = 8;
    const list = instancias || [];
    // jid -> instâncias capazes de ler (para fetch de participants em fallback)
    const jidReaders = new Map<string, Array<{ server_url: string; instance_token: string; id: string }>>();
    for (let off = 0; off < list.length; off += CHUNK) {
      await Promise.all(list.slice(off, off + CHUNK).map(async (inst: any) => {
        const arr = await fetchGroups(inst.server_url, inst.instance_token);
        for (const raw of arr) {
          const g = normalizeGroup(raw);
          if (!g.jid || !g.nome.toLowerCase().includes(namePattern)) continue;
          const cur = grupos.get(g.jid) || { nome: g.nome, participantes: new Set<string>(), admin_inst_id: inst.id };
          cur.nome = cur.nome || g.nome;
          if (Array.isArray(g.participants)) {
            for (const p of g.participants) {
              const phoneSrc: string = p?.PhoneNumber || p?.phoneNumber || p?.id || p?.JID || p?.jid || "";
              const num = String(phoneSrc).replace(/[^0-9]/g, "");
              const suf = num.slice(-8);
              if (suf) cur.participantes.add(suf);
            }
          }
          grupos.set(g.jid, cur);
          const readers = jidReaders.get(g.jid) || [];
          readers.push({ server_url: inst.server_url, instance_token: inst.instance_token, id: inst.id });
          jidReaders.set(g.jid, readers);
        }
      }));
    }

    // Fallback: para cada grupo sem participantes, buscar via /group/info usando readers conhecidos
    for (const [jid, info] of grupos.entries()) {
      if (info.participantes.size > 0) continue;
      const readers = jidReaders.get(jid) || [];
      for (const r of readers.slice(0, 3)) {
        const parts = await fetchGroupParticipants(r.server_url, r.instance_token, jid);
        if (parts.length === 0) continue;
        for (const p of parts) {
          const phoneSrc: string = (p as any)?.PhoneNumber || (p as any)?.phoneNumber || (p as any)?.id || (p as any)?.JID || (p as any)?.jid || "";
          const num = String(phoneSrc).replace(/[^0-9]/g, "");
          const suf = num.slice(-8);
          if (suf) info.participantes.add(suf);
        }
        if (info.participantes.size > 0) break;
      }
    }

    if (grupos.size === 0) {
      return new Response(JSON.stringify({ ok: true, grupos_encontrados: 0, message: `Nenhum grupo com '${namePattern}' encontrado` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resumo: any[] = [];
    let totalMembrosInseridos = 0;

    for (const [jid, info] of grupos.entries()) {
      // Upsert grupo
      const { data: gExist } = await supa
        .from("whatsapp_aquecimento_grupos")
        .select("id")
        .eq("group_jid", jid)
        .maybeSingle();

      let grupoId: string;
      if (gExist) {
        grupoId = gExist.id;
        await supa.from("whatsapp_aquecimento_grupos")
          .update({ nome: info.nome, ativo: true, instancia_admin_id: info.admin_inst_id })
          .eq("id", grupoId);
      } else {
        const { data: ins, error: insErr } = await supa.from("whatsapp_aquecimento_grupos")
          .insert({
            group_jid: jid,
            nome: info.nome,
            instancia_admin_id: info.admin_inst_id,
            auto_add_novas: true,
            ativo: true,
          })
          .select("id")
          .single();
        if (insErr) { resumo.push({ jid, nome: info.nome, erro: insErr.message }); continue; }
        grupoId = ins.id;
      }

      // Upsert config default (apenas se não existir)
      const { data: cfgExist } = await supa.from("whatsapp_aquecimento_grupo_config")
        .select("grupo_id").eq("grupo_id", grupoId).maybeSingle();
      if (!cfgExist) {
        await supa.from("whatsapp_aquecimento_grupo_config").insert({
          grupo_id: grupoId,
          ativo: true,
          msgs_min_dia: 15,
          msgs_max_dia: 25,
          mix_texto: 70,
          mix_audio: 20,
          mix_imagem: 10,
          carencia_horas: 24,
          max_msgs_por_instancia_dia: 6,
          max_audios_por_instancia_dia: 2,
          max_imagens_por_instancia_dia: 1,
        });
      }

      // Membros: para cada participante do WA que casa com instância, upsert
      const adicionadoEm = new Date(Date.now() - 25 * 3600 * 1000).toISOString(); // pula carência
      let inseridos = 0;
      const matched: string[] = [];
      for (const suf of info.participantes) {
        const inst = sufToInst.get(suf);
        if (!inst) continue;
        matched.push(inst.nome || inst.id.slice(0, 8));
        const { data: mExist } = await supa.from("whatsapp_aquecimento_grupo_membros")
          .select("id, status").eq("grupo_id", grupoId).eq("instancia_id", inst.id).maybeSingle();
        if (mExist) {
          if (mExist.status !== "ok") {
            await supa.from("whatsapp_aquecimento_grupo_membros")
              .update({ status: "ok", adicionado_em: adicionadoEm, erro_mensagem: null })
              .eq("id", mExist.id);
          }
        } else {
          const { error: mErr } = await supa.from("whatsapp_aquecimento_grupo_membros").insert({
            grupo_id: grupoId,
            instancia_id: inst.id,
            status: "ok",
            adicionado_em: adicionadoEm,
            tentativas: 0,
          });
          if (!mErr) inseridos++;
        }
      }
      totalMembrosInseridos += inseridos;
      resumo.push({
        jid,
        nome: info.nome,
        grupo_id: grupoId,
        participantes_wa: info.participantes.size,
        membros_matchados: matched.length,
        novos_inseridos: inseridos,
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      grupos_encontrados: grupos.size,
      total_membros_inseridos: totalMembrosInseridos,
      grupos: resumo,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[descobrir-grupos] erro:", e);
    return new Response(JSON.stringify({ ok: false, error: e?.message || String(e), fallback: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
