// Sincroniza o Relatório de Acionamentos com os dados do Inbox Meta Oficial
// e envia resumo no WhatsApp (parcial de hora em hora + consolidado do dia).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";
import { notificarNumeros } from "../_shared/notificar-numeros.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DESTINATARIOS = ["62991672674", "62994300880"];

const HORAS = [
  "8h-9h", "9h-10h", "10h-11h", "11h-12h", "12h-13h", "13h-14h",
  "14h-15h", "15h-16h", "16h-17h", "17h-18h", "18h-19h",
];
const HORA_INICIO = 8; // 08h BRT
const horaLabel = (h: number) => `${h}h-${h + 1}h`;

const suf8 = (t: unknown) => String(t ?? "").replace(/\D/g, "").slice(-8);
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (num: number, den: number) => (den > 0 ? `${((num / den) * 100).toFixed(1).replace(".", ",")}%` : "0%");

function brtParts(d: Date) {
  const s = d.toLocaleString("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  // formato: 2026-08-05, 14:32
  const [dia, hm] = s.split(", ");
  const [hh, mm] = hm.split(":");
  return { dia, hora: Number(hh), minuto: Number(mm) };
}

// Lê todas as linhas paginando (a API corta o resultado em 1000 linhas por consulta)
async function fetchAll(
  build: () => any,
  ordem: string,
  passo = 1000,
  maxPaginas = 200,
): Promise<any[]> {
  const out: any[] = [];
  for (let p = 0; p < maxPaginas; p++) {
    const from = p * passo;
    const { data, error } = await build()
      .order(ordem, { ascending: true })
      .range(from, from + passo - 1);
    if (error) throw error;
    const lote = data || [];
    out.push(...lote);
    if (lote.length < passo) break;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    let body: any = {};
    try { body = await req.json(); } catch (_) { /* sem body */ }

    const agora = brtParts(new Date());
    const dia: string = body.dia || agora.dia;
    const notificar: boolean = body.notificar !== false;
    const consolidado: boolean = body.consolidado === true;

    // Janela do dia em BRT
    const inicioDia = `${dia}T00:00:00-03:00`;
    const fimDia = `${dia}T23:59:59-03:00`;

    // === Mensagens do Inbox Meta no dia (paginado) ===
    const msgs = await fetchAll(
      () => supabase
        .from("meta_whatsapp_mensagens")
        .select("telefone, direcao, timestamp_msg")
        .gte("timestamp_msg", inicioDia)
        .lte("timestamp_msg", fimDia),
      "timestamp_msg",
    );

    // === Acordos criados no dia (paginado) ===
    const acordos = await fetchAll(
      () => supabase
        .from("acordos")
        .select("cliente_telefone, valor_total, criado_em")
        .gte("criado_em", inicioDia)
        .lte("criado_em", fimDia),
      "criado_em",
    );

    const acordoSufixos = new Set(
      (acordos || []).map((a: any) => suf8(a.cliente_telefone)).filter((s: string) => s.length === 8),
    );

    // Acordos por faixa de hora — CPC-A = todo acordo lançado no sistema
    const acordosPorHora = new Map<string, number>();
    for (const h of HORAS) acordosPorHora.set(h, 0);
    for (const a of (acordos || []) as any[]) {
      const p = brtParts(new Date(a.criado_em));
      const label = horaLabel(p.hora);
      if (!acordosPorHora.has(label)) continue;
      acordosPorHora.set(label, (acordosPorHora.get(label) || 0) + 1);
    }

    // === Consultas do portal de negociação no dia (CPC por portal) ===
    const consultas = await fetchAll(
      () => supabase
        .from("consulta_cpf_notificacoes")
        .select("cpf, telefones_suffix, created_at")
        .gte("created_at", inicioDia)
        .lte("created_at", fimDia),
      "created_at",
    );

    // Buckets por hora: envios contam por volume; respostas por telefone único
    type Bucket = { envios: number; entrada: Set<string> };
    const buckets = new Map<string, Bucket>();
    for (const h of HORAS) buckets.set(h, { envios: 0, entrada: new Set() });

    for (const m of (msgs || []) as any[]) {
      const s = suf8(m.telefone);
      if (!s) continue;
      const p = brtParts(new Date(m.timestamp_msg));
      const label = horaLabel(p.hora);
      const b = buckets.get(label);
      if (!b) continue; // fora da faixa 08h-19h
      if (String(m.direcao) === "saida") b.envios++;
      else b.entrada.add(s);
    }

    // Portal: chave = sufixo do telefone quando existir, senão o CPF normalizado
    const portalBuckets = new Map<string, Set<string>>();
    for (const h of HORAS) portalBuckets.set(h, new Set());
    for (const c of (consultas || []) as any[]) {
      const p = brtParts(new Date(c.created_at));
      const set = portalBuckets.get(horaLabel(p.hora));
      if (!set) continue;
      const sufixos: string[] = Array.isArray(c.telefones_suffix)
        ? c.telefones_suffix.map((t: unknown) => suf8(t)).filter((s: string) => s.length === 8)
        : [];
      if (sufixos.length) sufixos.forEach((s) => set.add(s));
      else {
        const cpf = String(c.cpf ?? "").replace(/\D/g, "");
        if (cpf) set.add(`cpf:${cpf}`);
      }
    }

    // === Ligações da 3C Plus (cache local) ===
    const ligacoes = await fetchAll(
      () => supabase
        .from("tresc_ligacoes")
        .select("call_id, hora, telefone_sufixo, atendida")
        .eq("data", dia),
      "call_id",
    );

    // Toda ligação falada no discador conta como CPC (cliente localizado)
    type LigBucket = { total: number; alo: number; cpc: Set<string> };
    const ligBuckets = new Map<string, LigBucket>();
    for (const h of HORAS) ligBuckets.set(h, { total: 0, alo: 0, cpc: new Set() });
    for (const l of (ligacoes || []) as any[]) {
      const b = ligBuckets.get(String(l.hora));
      if (!b) continue;
      b.total++;
      if (!l.atendida) continue;
      b.alo++;
      const s = suf8(l.telefone_sufixo);
      if (s) b.cpc.add(s);
    }


    // WhatsApp/tentativas = volume de disparos. CPC = pessoa única por dia. CPC-A = acordos lançados.
    const jaContado = new Set<string>();
    const linhas: Array<{
      hora: string; whatsapp: number; ligacoes: number; alo: number; tentativas: number;
      cpc: number; cpca: number; cpcWhats: number; cpcLig: number; cpcPortal: number;
    }> = [];

    for (const h of HORAS) {
      const b = buckets.get(h)!;
      const lb = ligBuckets.get(h)!;
      const pb = portalBuckets.get(h)!;
      let cpcWhats = 0, cpcLig = 0, cpcPortal = 0;
      const whatsapp = b.envios;

      // CPC por WhatsApp (resposta do cliente)
      for (const s of b.entrada) {
        if (jaContado.has(s)) continue;
        jaContado.add(s);
        cpcWhats++;
      }
      // CPC por ligação falada no discador
      for (const s of lb.cpc) {
        if (jaContado.has(s)) continue;
        jaContado.add(s);
        cpcLig++;
      }
      // CPC por consulta no portal de negociação
      for (const s of pb) {
        if (jaContado.has(s)) continue;
        jaContado.add(s);
        cpcPortal++;
      }

      linhas.push({
        hora: h,
        whatsapp,
        ligacoes: lb.total,
        alo: lb.alo,
        tentativas: whatsapp + lb.total,
        cpc: cpcWhats + cpcLig + cpcPortal,
        cpca: acordosPorHora.get(h) || 0,
        cpcWhats,
        cpcLig,
        cpcPortal,
      });
    }


    // === Linhas já existentes (respeita edições manuais) ===
    const { data: existentes } = await supabase
      .from("relatorio_acionamentos")
      .select("hora, tentativas, whatsapp, alo, cpc, cpca, acordos_valor, whatsapp_manual, cpc_manual, cpca_manual, tentativas_manual, alo_manual")
      .eq("data", dia);
    const exMap = new Map<string, any>();
    (existentes || []).forEach((r: any) => exMap.set(r.hora, r));

    const upserts = linhas.map((l) => {
      const ex = exMap.get(l.hora) || {};
      return {
        data: dia,
        hora: l.hora,
        whatsapp_auto: l.whatsapp,
        ligacoes_auto: l.ligacoes,
        alo_auto: l.alo,
        cpc_auto: l.cpc,
        cpca_auto: l.cpca,
        cpc_whatsapp_auto: l.cpcWhats,
        cpc_ligacao_auto: l.cpcLig,
        cpc_portal_auto: l.cpcPortal,
        tentativas_auto: l.tentativas,
        whatsapp: ex.whatsapp_manual ? ex.whatsapp ?? 0 : l.whatsapp,
        alo: ex.alo_manual ? ex.alo ?? 0 : l.alo,
        cpc: ex.cpc_manual ? ex.cpc ?? 0 : l.cpc,
        cpca: ex.cpca_manual ? ex.cpca ?? 0 : l.cpca,
        tentativas: ex.tentativas_manual ? ex.tentativas ?? 0 : l.tentativas,
        sync_em: new Date().toISOString(),
      };
    });

    const { error: upErr } = await supabase
      .from("relatorio_acionamentos")
      .upsert(upserts, { onConflict: "data,hora" });
    if (upErr) throw upErr;


    // Totais (usa valores finais gravados + valor de acordos já existente na tabela)
    const { data: finais } = await supabase
      .from("relatorio_acionamentos")
      .select("hora, tentativas, whatsapp, alo, cpc, cpca, acordos_valor")
      .eq("data", dia);

    const tot = { tentativas: 0, whatsapp: 0, alo: 0, cpc: 0, cpca: 0, valor: 0 };
    (finais || []).forEach((r: any) => {
      tot.tentativas += r.tentativas || 0;
      tot.whatsapp += r.whatsapp || 0;
      tot.alo += r.alo || 0;
      tot.cpc += r.cpc || 0;
      tot.cpca += r.cpca || 0;
      tot.valor += Number(r.acordos_valor || 0);
    });

    const totalAcordos = (acordos || []).length;
    const valorAcordos = (acordos || []).reduce((s: number, a: any) => s + Number(a.valor_total || 0), 0);
    const totLigacoes = linhas.reduce((s, l) => s + l.ligacoes, 0);
    const cpcWhats = linhas.reduce((s, l) => s + l.cpcWhats, 0);
    const cpcLig = linhas.reduce((s, l) => s + l.cpcLig, 0);
    const cpcPortal = linhas.reduce((s, l) => s + l.cpcPortal, 0);


    let enviado: any = { skipped: true };
    if (notificar) {
      const [a, m, d] = dia.split("-");
      const dataFmt = `${d}/${m}/${a}`;
      const titulo = consolidado
        ? `📊 *RELATÓRIO CONSOLIDADO — ${dataFmt}*`
        : `📊 *PARCIAL ${dataFmt} — ${String(agora.hora).padStart(2, "0")}h*`;

      const linhasMsg = [
        titulo,
        "",
        `📣 Acionamentos: *${tot.tentativas}*`,
        `💬 WhatsApp (Meta): *${tot.whatsapp}*`,
        `📞 Ligações (3C): *${totLigacoes}*  | Alô: *${tot.alo}* (${pct(tot.alo, totLigacoes)})`,
        `🗣️ Interações/CPC: *${tot.cpc}*  (${pct(tot.cpc, tot.tentativas)})`,
        `   ↳ WhatsApp: ${cpcWhats} • Ligação: ${cpcLig} • Portal: ${cpcPortal}`,
        `🤝 CPC-A: *${tot.cpca}*  (${pct(tot.cpca, tot.cpc)})`,

        `📄 Acordos lançados: *${totalAcordos}*`,
        `💵 Valor em acordos: *${brl(valorAcordos || tot.valor)}*`,
        "",
        "*Por hora (acion. / CPC / CPC-A):*",
        ...(finais || [])
          .slice()
          .sort((x: any, y: any) => HORAS.indexOf(x.hora) - HORAS.indexOf(y.hora))
          .filter((r: any) => (r.tentativas || 0) + (r.cpc || 0) > 0)
          .map((r: any) => `• ${r.hora}: ${r.tentativas || 0} / ${r.cpc || 0} / ${r.cpca || 0}`),
      ];

      const chave = consolidado
        ? `relat-acion-consol-${dia}`
        : `relat-acion-${dia}-${String(agora.hora).padStart(2, "0")}h`;

      // Destinos extras configurados (grupos de WhatsApp)
      const { data: destinos } = await supabase
        .from("relatorio_destinos")
        .select("jid, instancia_id")
        .eq("ativo", true);
      const grupos = (destinos || [])
        .map((d: any) => String(d.jid || "").trim())
        .filter((j: string) => j.length > 0);
      const instanciaPorDestino: Record<string, string> = {};
      for (const d of (destinos || []) as any[]) {
        const j = String(d.jid || "").trim();
        if (j && d.instancia_id) instanciaPorDestino[j] = d.instancia_id;
      }

      enviado = await notificarNumeros(supabase, {
        tipo: consolidado ? "relatorio_acionamentos_dia" : "relatorio_acionamentos_hora",
        mensagem: linhasMsg.join("\n"),
        destinatarios: [...DESTINATARIOS, ...grupos],
        instanciaPorDestino,
        chaveIdempotencia: chave,
      });

    }


    return new Response(JSON.stringify({ ok: true, dia, totais: tot, totalAcordos, valorAcordos, notificacao: enviado }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("relatorio-acionamentos-sync erro:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
