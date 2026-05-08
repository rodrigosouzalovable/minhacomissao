import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MATURACAO_MS = 5 * 86400000;
const MAX_PER_ADMIN_DAY = 2;
const MAX_PER_GROUP_DAY = 5;
const COOLDOWN_HOURS_ON_BLOCK = 24;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json().catch(() => ({}));
    const instanciaId: string | undefined = body.instancia_id;
    const forceAdderId: string | undefined = body.adder_instance_id; // manual override
    const action: string = body.action || "add"; // "add" | "promote"
    const isManual = !!instanciaId || action === "promote";

    // Manual promote mode: promove a instancia_id como admin do grupo
    if (action === "promote" && instanciaId) {
      return await handleManualPromote(supabase, instanciaId);
    }

    const { data: grupos } = await supabase
      .from("whatsapp_aquecimento_grupos")
      .select("*")
      .eq("ativo", true)
      .eq("auto_add_novas", true);

    if (!grupos || grupos.length === 0) {
      return json({ message: "Nenhum grupo ativo com auto-add" });
    }

    // Janela horária (sweep apenas)
    const hourBR = parseInt(
      new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false })
    );
    const dowBR = new Date().toLocaleDateString("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" });

    const results: any[] = [];
    let addedThisCall = 0;
    const MAX_PER_CALL = isManual ? 99 : 1;

    // Carrega todas instâncias ativas (cache)
    const { data: allActive } = await supabase
      .from("user_whatsapp_instances")
      .select("id, nome, server_url, instance_token, criado_em, ativo")
      .eq("ativo", true);

    const activeById = new Map<string, any>((allActive || []).map((i: any) => [i.id, i]));
    const activeByPhoneSuffix = new Map<string, any>();
    for (const i of allActive || []) {
      const phone = (i.nome || "").match(/\d+/)?.[0];
      if (phone) activeByPhoneSuffix.set(phone.slice(-8), i);
    }

    for (const grupo of grupos) {
      if (!isManual && (hourBR < 7 || hourBR >= 21 || dowBR === "Sun")) {
        results.push({ grupo: grupo.nome, skipped: "fora de horário" });
        continue;
      }

      // Reader: instância oficial do grupo (apenas para chamar /group/info)
      const reader = activeById.get(grupo.instancia_admin_id);
      if (!reader) {
        results.push({ grupo: grupo.nome, skipped: "instancia_admin_id não está ativa" });
        continue;
      }

      // 1) Buscar admins reais do grupo via UAZAPI
      const adminInsts = await fetchGroupAdmins(reader, grupo.group_jid, activeByPhoneSuffix);
      if (adminInsts.length === 0) {
        results.push({ grupo: grupo.nome, skipped: "nenhum admin ativo encontrado no grupo" });
        continue;
      }

      // 2) Cap diário do grupo
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { count: addsHojeGrupo } = await supabase
        .from("whatsapp_aquecimento_grupo_membros")
        .select("*", { count: "exact", head: true })
        .eq("grupo_id", grupo.id)
        .eq("status", "ok")
        .gte("adicionado_em", todayStart.toISOString());

      if ((addsHojeGrupo || 0) >= MAX_PER_GROUP_DAY && !isManual) {
        results.push({ grupo: grupo.nome, skipped: `limite diário do grupo (${MAX_PER_GROUP_DAY}) atingido` });
        continue;
      }

      // 3) Para cada admin do pool, contar adds do dia + cooldown
      const adderStats = await Promise.all(adminInsts.map(async (adm) => {
        const { count } = await supabase
          .from("whatsapp_aquecimento_grupo_membros")
          .select("*", { count: "exact", head: true })
          .eq("grupo_id", grupo.id)
          .eq("status", "ok")
          .eq("adicionado_por_instancia_id", adm.id)
          .gte("adicionado_em", todayStart.toISOString());

        const { data: cooldownRow } = await supabase
          .from("whatsapp_aquecimento_grupo_membros")
          .select("bloqueado_ate")
          .eq("grupo_id", grupo.id)
          .eq("adicionado_por_instancia_id", adm.id)
          .not("bloqueado_ate", "is", null)
          .order("bloqueado_ate", { ascending: false })
          .limit(1)
          .maybeSingle();

        const bloqAte = cooldownRow?.bloqueado_ate ? new Date(cooldownRow.bloqueado_ate).getTime() : 0;
        const inCooldown = bloqAte > Date.now();

        const { data: lastAdd } = await supabase
          .from("whatsapp_aquecimento_grupo_membros")
          .select("adicionado_em")
          .eq("grupo_id", grupo.id)
          .eq("adicionado_por_instancia_id", adm.id)
          .order("adicionado_em", { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          inst: adm,
          adds_hoje: count || 0,
          in_cooldown: inCooldown,
          last_add_ts: lastAdd?.adicionado_em ? new Date(lastAdd.adicionado_em).getTime() : 0,
        };
      }));

      // Filtra elegíveis: < cap diário, sem cooldown
      const eligibleAdders = adderStats
        .filter((s) => !s.in_cooldown && s.adds_hoje < MAX_PER_ADMIN_DAY)
        .sort((a, b) => a.adds_hoje - b.adds_hoje || a.last_add_ts - b.last_add_ts);

      if (eligibleAdders.length === 0) {
        results.push({ grupo: grupo.nome, skipped: "nenhum admin elegível (cap diário ou cooldown)" });
        continue;
      }

      // Override manual
      let chosenAdder = eligibleAdders[0];
      if (forceAdderId) {
        const f = eligibleAdders.find((s) => s.inst.id === forceAdderId);
        if (f) chosenAdder = f;
      }

      // 4) Determinar instâncias-alvo
      let targets: any[] = [];
      if (instanciaId) {
        const t = activeById.get(instanciaId);
        if (t) targets = [t];
      } else {
        targets = (allActive || []).filter((i: any) => {
          const idade = Date.now() - new Date(i.criado_em).getTime();
          return idade >= MATURACAO_MS && i.id !== grupo.instancia_admin_id;
        });
      }

      for (const target of targets) {
        if (addedThisCall >= MAX_PER_CALL) break;
        if (target.id === chosenAdder.inst.id) continue;

        const { data: existing } = await supabase
          .from("whatsapp_aquecimento_grupo_membros")
          .select("id, status, tentativas")
          .eq("grupo_id", grupo.id)
          .eq("instancia_id", target.id)
          .maybeSingle();

        if (existing && ["ok", "removido_manualmente"].includes(existing.status)) continue;
        if (existing && existing.tentativas >= 5) continue;

        const phone = target.nome?.match(/\d+/)?.[0];
        if (!phone) {
          await upsertMember(supabase, grupo.id, target.id, existing?.id, "erro", chosenAdder.inst.id, {
            erro_mensagem: "Sem telefone no nome",
          });
          continue;
        }
        const fullPhone = phone.startsWith("55") ? phone : `55${phone}`;

        // Chamada UAZAPI usando o ADDER do round-robin
        try {
          const url = `${chosenAdder.inst.server_url.replace(/\/$/, "")}/group/updateParticipants`;
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              token: chosenAdder.inst.instance_token,
            },
            body: JSON.stringify({
              groupjid: grupo.group_jid,
              action: "add",
              participants: [fullPhone],
            }),
          });
          const text = await res.text();
          let parsed: any = {};
          try { parsed = JSON.parse(text); } catch {}

          const lower = text.toLowerCase();
          const isBlocked = lower.includes("blocked-integrity-enforcement") || lower.includes("not allowed");
          const hasRealError =
            (parsed && typeof parsed.error === "string" && parsed.error.length > 0) ||
            parsed?.success === false ||
            lower.includes("\"message\":\"error") ||
            isBlocked ||
            lower.includes("not admin") ||
            lower.includes("not_admin") ||
            lower.includes("disconnected") ||
            lower.includes("not connected");

          if (res.ok && !hasRealError) {
            const inviteMatch = text.match(/https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+/);
            if (inviteMatch) {
              await upsertMember(supabase, grupo.id, target.id, existing?.id, "convite_necessario", chosenAdder.inst.id, {
                invite_link: inviteMatch[0],
                erro_mensagem: "Privacidade exige convite manual",
              });
              results.push({ grupo: grupo.nome, target: target.nome, adder: chosenAdder.inst.nome, status: "convite_necessario" });
            } else {
              await upsertMember(supabase, grupo.id, target.id, existing?.id, "ok", chosenAdder.inst.id, {
                adicionado_em: new Date().toISOString(),
              });
              results.push({ grupo: grupo.nome, target: target.nome, adder: chosenAdder.inst.nome, status: "ok" });
              addedThisCall++;
            }
          } else if (isBlocked) {
            // Coloca o ADDER em cooldown 24h
            const cooldownUntil = new Date(Date.now() + COOLDOWN_HOURS_ON_BLOCK * 3600 * 1000).toISOString();
            await upsertMember(supabase, grupo.id, target.id, existing?.id, "erro", chosenAdder.inst.id, {
              erro_mensagem: "Admin bloqueado pelo WhatsApp (integrity-enforcement)",
              bloqueado_ate: cooldownUntil,
            });
            results.push({ grupo: grupo.nome, target: target.nome, adder: chosenAdder.inst.nome, status: "adder_em_cooldown_24h" });
            break;
          } else if (lower.includes("not admin") || lower.includes("not_admin")) {
            await upsertMember(supabase, grupo.id, target.id, existing?.id, "erro", chosenAdder.inst.id, {
              erro_mensagem: "Adder não é mais admin do grupo",
            });
            results.push({ grupo: grupo.nome, status: "adder_nao_admin", adder: chosenAdder.inst.nome });
            break;
          } else if (lower.includes("disconnected") || lower.includes("not connected")) {
            results.push({ grupo: grupo.nome, status: "adder_desconectado", adder: chosenAdder.inst.nome, fallback: true });
            break;
          } else {
            await upsertMember(supabase, grupo.id, target.id, existing?.id, "erro", chosenAdder.inst.id, {
              erro_mensagem: text.substring(0, 300),
            });
            results.push({ grupo: grupo.nome, target: target.nome, adder: chosenAdder.inst.nome, status: "erro", detail: text.substring(0, 100) });
          }
        } catch (e) {
          await upsertMember(supabase, grupo.id, target.id, existing?.id, "erro", chosenAdder.inst.id, {
            erro_mensagem: String(e).substring(0, 300),
          });
          results.push({ grupo: grupo.nome, target: target.nome, status: "exception", error: String(e) });
        }
      }
    }

    return json({ success: true, results, added: addedThisCall });
  } catch (err) {
    console.error("[ADD-WARMING-GROUP]", err);
    return json({ error: String(err) }, 500);
  }
});

async function fetchGroupAdmins(reader: any, groupJid: string, activeByPhoneSuffix: Map<string, any>): Promise<any[]> {
  const base = reader.server_url.replace(/\/$/, "");
  const headers = { "Content-Type": "application/json", token: reader.instance_token };

  const attempts = [
    { url: `${base}/group/info`, method: "POST", body: JSON.stringify({ groupjid: groupJid }) },
    { url: `${base}/group/info?groupjid=${encodeURIComponent(groupJid)}`, method: "GET" },
    { url: `${base}/group/getParticipants`, method: "POST", body: JSON.stringify({ groupjid: groupJid }) },
  ];

  let participants: any[] = [];
  for (const a of attempts) {
    try {
      const res = await fetch(a.url, { method: a.method, headers, body: a.body });
      if (!res.ok) continue;
      const txt = await res.text();
      const j = JSON.parse(txt);
      participants = j?.Participants || j?.participants || j?.group?.participants || [];
      if (participants.length > 0) break;
    } catch { /* tenta próximo */ }
  }

  if (participants.length === 0) return [];

  const adminInsts: any[] = [];
  const seen = new Set<string>();
  for (const p of participants) {
    const isAdmin = p.IsAdmin || p.isAdmin || p.IsSuperAdmin || p.admin === "admin" || p.admin === "superadmin";
    if (!isAdmin) continue;
    // Prioriza PhoneNumber (formato 556282...@s.whatsapp.net) sobre JID (que pode ser @lid sem telefone)
    const phoneSrc: string = p.PhoneNumber || p.phoneNumber || p.JID || p.jid || p.id || "";
    const num = phoneSrc.replace(/[^0-9]/g, "");
    if (!num) continue;
    const suffix = num.slice(-8);
    const inst = activeByPhoneSuffix.get(suffix);
    if (inst && !seen.has(inst.id)) {
      seen.add(inst.id);
      adminInsts.push(inst);
    }
  }
  return adminInsts;
}

async function upsertMember(
  supabase: any,
  grupo_id: string,
  instancia_id: string,
  existingId: string | undefined,
  status: string,
  adicionado_por_instancia_id: string | null,
  extra: Record<string, any>
) {
  const payload: any = {
    status,
    ultima_tentativa_em: new Date().toISOString(),
    adicionado_por_instancia_id,
    ...extra,
  };

  if (existingId) {
    const { data: cur } = await supabase
      .from("whatsapp_aquecimento_grupo_membros")
      .select("tentativas")
      .eq("id", existingId)
      .maybeSingle();
    payload.tentativas = (cur?.tentativas || 0) + 1;
    await supabase.from("whatsapp_aquecimento_grupo_membros").update(payload).eq("id", existingId);
  } else {
    payload.grupo_id = grupo_id;
    payload.instancia_id = instancia_id;
    payload.tentativas = 1;
    await supabase.from("whatsapp_aquecimento_grupo_membros").insert(payload);
  }
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
