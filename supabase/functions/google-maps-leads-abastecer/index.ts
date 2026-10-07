// Reabastece a lista de contatos do Google Maps usada no resgate de engajamento.
// Roda de carona no tick do aquecimento (sem cron novo):
//  - persegue 1.000 contatos inéditos com WhatsApp confirmado em cada dia
//  - escolhe os nichos/cidades com melhor histórico de resposta (aquecimento_nicho_score)
//  - busca no Google Maps, confirma quem tem WhatsApp e guarda sem duplicar telefone
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";
import { hojeBrt } from "../_shared/meta-aquecimento-alvo.ts";
import { notificarNumeros } from "../_shared/notificar-numeros.ts";
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { REPOSICAO_CADASTRAL } from '../_shared/recuperacao-cadastral-rules.ts';

const META_WHATSAPP_DIA = 1000;
const MAX_REQUISICOES_POR_DIA = 650;
const MAX_REQUISICOES_POR_RUN = 18;
// Até 120 empresas por rodada: os seis ticks entre 07h e 07h50 conseguem
// formar o estoque antes do aquecimento, respeitando o teto diário de consultas.
const MAX_RESULTADOS = 120;
const DESTINATARIOS_AVISO = ["62991672674"];

const SEMENTES = [
  { nicho: "clínica odontológica", cidade: "Goiânia GO" },
  { nicho: "psicólogo", cidade: "Goiânia GO" },
  { nicho: "clínica veterinária", cidade: "Goiânia GO" },
  { nicho: "contabilidade", cidade: "Goiânia GO" },
  { nicho: "imobiliária", cidade: "Goiânia GO" },
  { nicho: "academia", cidade: "Goiânia GO" },
  { nicho: "clínica odontológica", cidade: "Aparecida de Goiânia GO" },
  { nicho: "contabilidade", cidade: "Anápolis GO" },
  { nicho: "imobiliária", cidade: "Brasília DF" },
  { nicho: "clínica de estética", cidade: "Goiânia GO" },
  { nicho: "fisioterapia", cidade: "Goiânia GO" },
  { nicho: "advocacia", cidade: "Goiânia GO" },
  { nicho: "pet shop", cidade: "Goiânia GO" },
  { nicho: "restaurante", cidade: "Goiânia GO" },
  { nicho: "oficina mecânica", cidade: "Goiânia GO" },
  { nicho: "materiais de construção", cidade: "Aparecida de Goiânia GO" },
  { nicho: "auto elétrica", cidade: "Anápolis GO" },
  { nicho: "marmoraria", cidade: "Brasília DF" },
  { nicho: "clínica odontológica", cidade: "Rio Verde GO" },
  { nicho: "contabilidade", cidade: "Catalão GO" },
  { nicho: "imobiliária", cidade: "Uberlândia MG" },
  { nicho: "academia", cidade: "Campo Grande MS" },
  { nicho: "clínica veterinária", cidade: "Cuiabá MT" },
  { nicho: "ótica", cidade: "Palmas TO" },
  { nicho: "pizzaria", cidade: "Belo Horizonte MG" },
  { nicho: "dedetizadora", cidade: "Brasília DF" },
  { nicho: "escola de idiomas", cidade: "Goiânia GO" },
  { nicho: "barbearia", cidade: "Aparecida de Goiânia GO" },
  { nicho: "salão de beleza", cidade: "Anápolis GO" },
  { nicho: "loja de roupas", cidade: "Brasília DF" },
  { nicho: "loja de autopeças", cidade: "Goiânia GO" },
  { nicho: "farmácia", cidade: "Aparecida de Goiânia GO" },
  { nicho: "supermercado", cidade: "Anápolis GO" },
  { nicho: "eletricista", cidade: "Brasília DF" },
  { nicho: "encanador", cidade: "Goiânia GO" },
  { nicho: "assistência técnica de celular", cidade: "Aparecida de Goiânia GO" },
  { nicho: "loja de móveis", cidade: "Anápolis GO" },
  { nicho: "empresa de energia solar", cidade: "Brasília DF" },
  { nicho: "corretora de seguros", cidade: "Goiânia GO" },
  { nicho: "agência de viagens", cidade: "Aparecida de Goiânia GO" },
  { nicho: "escola particular", cidade: "Anápolis GO" },
  { nicho: "laboratório de análises clínicas", cidade: "Brasília DF" },
  { nicho: "clínica médica", cidade: "Rio Verde GO" },
  { nicho: "loja de materiais elétricos", cidade: "Uberlândia MG" },
  { nicho: "distribuidora de bebidas", cidade: "Campo Grande MS" },
  { nicho: "empresa de segurança eletrônica", cidade: "Cuiabá MT" },
  { nicho: "loja de celulares", cidade: "Palmas TO" },
  { nicho: "restaurante", cidade: "Aparecida de Goiânia GO" },
  { nicho: "academia", cidade: "Anápolis GO" },
  { nicho: "pet shop", cidade: "Brasília DF" },
  { nicho: "imobiliária", cidade: "Rio Verde GO" },
  { nicho: "clínica odontológica", cidade: "Uberlândia MG" },
  { nicho: "oficina mecânica", cidade: "Campo Grande MS" },
  { nicho: "contabilidade", cidade: "Cuiabá MT" },
  { nicho: "clínica veterinária", cidade: "Palmas TO" },
];

const chaveAlvo = (nicho: string, cidade: string) =>
  `${nicho.trim().toLocaleLowerCase("pt-BR")}|${cidade.trim().toLocaleLowerCase("pt-BR")}`;

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function haInstanciaVerificadora(supabase: any) {
  const { data: instancias } = await supabase
    .from("user_whatsapp_instances")
    .select("server_url, instance_token")
    .eq("ativo", true)
    .not("server_url", "is", null)
    .not("instance_token", "is", null);

  for (const inst of instancias ?? []) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(`${String(inst.server_url).replace(/\/+$/, "")}/instance/status`, {
        headers: { token: String(inst.instance_token) },
        signal: controller.signal,
      });
      if (!response.ok) continue;
      const data = await response.json().catch(() => ({}));
      const estado = String(data?.instance?.status ?? data?.status?.status ?? data?.status ?? "").toLowerCase();
      if (data?.connected === true || data?.status?.connected === true || ["connected", "open", "online", "ready"].includes(estado)) {
        return true;
      }
    } catch (_) {
      // Tenta a próxima instância.
    } finally {
      clearTimeout(timeout);
    }
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: poolConfig } = await supabase
    .from("meta_envio_pool_config")
    .select("google_maps_captacao_ativa")
    .eq("id", 1)
    .maybeSingle();
  if (poolConfig?.google_maps_captacao_ativa === false) {
    return json({ ok: true, skipped: "captacao_google_maps_pausada" });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const cadastral = body?.tipo === 'cadastral';
    if (cadastral) {
      const tokenAuth = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      if (tokenAuth !== Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) return json({ error: 'Acesso interno obrigatório' }, 401);
      if (!/^[0-9a-f-]{36}$/i.test(String(body.owner_id || '')) || !/^[0-9a-f-]{36}$/i.test(String(body.reposicao_token || ''))) return json({ error: 'Pedido de reposição inválido' }, 400);
      const { data: pedido } = await supabase.from('meta_recuperacao_cadastral_config').select('ativo, reposicao_em, reposicao_resultado')
        .eq('user_id', body.owner_id).eq('reposicao_token', body.reposicao_token).maybeSingle();
      if (!pedido?.ativo || pedido.reposicao_resultado || !pedido.reposicao_em || Date.now() - new Date(pedido.reposicao_em).getTime() > 600000) return json({ error: 'Reposição não autorizada ou expirada' }, 403);
    }
    const dia = String(body?.dia || hojeBrt());
    const forcar = body?.forcar === true;

    // Single-flight persistente: ticks simultâneos não abrem buscas duplicadas.
    const token = crypto.randomUUID();
    const { data: lockOk, error: lockError } = await supabase.rpc("gm_abastecimento_claim", {
      p_token: token,
      p_lock_minutes: 9,
    });
    if (lockError) throw lockError;
    if (!lockOk) return json({ ok: true, skipped: "abastecimento_em_andamento" });

    try {

    // ===== Progresso diário: só contam contatos inéditos captados hoje e confirmados =====
    const carencia = new Date(Date.now() - 15 * 86400000).toISOString();
    const inicioDia = new Date(`${dia}T00:00:00-03:00`).toISOString();
    const fimDia = new Date(`${dia}T23:59:59-03:00`).toISOString();
    const { count: confirmadosHoje } = await supabase
      .from("google_maps_leads")
      .select("id", { count: "exact", head: true })
      .eq("tem_whatsapp", true)
      .gte("created_at", inicioDia)
      .lte("created_at", fimDia);
    const { count: estoque } = await supabase
      .from("google_maps_leads")
      .select("id", { count: "exact", head: true })
      .eq("tem_whatsapp", true)
      .or(`usado_aquecimento_em.is.null,usado_aquecimento_em.lt.${carencia}`);

    if (!forcar && (confirmadosHoje ?? 0) >= META_WHATSAPP_DIA) {
      return json({ ok: true, skipped: "meta_diaria_atingida", confirmados_hoje: confirmadosHoje ?? 0, meta: META_WHATSAPP_DIA });
    }

    // Não gasta consultas se não houver como transformar telefones em contatos confirmados.
    if (!(await haInstanciaVerificadora(supabase))) {
      return json({ ok: true, skipped: "sem_instancia_verificadora", confirmados_hoje: confirmadosHoje ?? 0, meta: META_WHATSAPP_DIA });
    }

    // ===== Orçamento diário de requisições Places =====
    const { data: buscasHoje } = await supabase
      .from("google_maps_buscas")
      .select("requisicoes_places, provedor_utilizado")
      .eq("origem", "resgate_engajamento")
      .gte("created_at", inicioDia);
    const requisicoesHoje = ((buscasHoje as any[]) || [])
      .reduce((s, b) => s + Number(b.requisicoes_places || 0), 0);
    const restantesHoje = Math.max(0, MAX_REQUISICOES_POR_DIA - requisicoesHoje);
    if (restantesHoje <= 0) {
      return json({ ok: true, skipped: "limite_diario_de_requisicoes", requisicoes_hoje: requisicoesHoje });
    }

    // ===== Melhor nicho/cidade conhecido =====
    const { data: scores } = await supabase
      .from("aquecimento_nicho_score")
      .select("nicho, cidade, score, envios, bloqueado")
      .eq("bloqueado", false)
      .order("score", { ascending: false })
      .limit(10);

    const bons = ((scores as any[]) || [])
      .filter((s) => Number(s.envios || 0) >= 3)
      .map((s) => ({ nicho: String(s.nicho), cidade: String(s.cidade || "Goiânia GO") }));
    const alvos = [...bons, ...SEMENTES].filter(
      (item, idx, arr) => arr.findIndex((x) => x.nicho === item.nicho && x.cidade === item.cidade) === idx,
    );
    // Prioriza combinações ainda não pesquisadas na semana. Quando todas já
    // foram usadas, escolhe pelo rendimento recente e deixa combinações com
    // três buscas seguidas sem nenhum número para o fim da fila.
    const inicioSemana = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: buscasRecentes } = await supabase
      .from("google_maps_buscas")
      .select("categoria, localizacao, total_resultados, created_at")
      .eq("origem", "resgate_engajamento")
      .gte("created_at", inicioSemana)
      .order("created_at", { ascending: false })
      .limit(1000);
    const historico = new Map<string, Array<{ total: number; em: string }>>();
    for (const busca of (buscasRecentes as any[]) || []) {
      const chave = chaveAlvo(String(busca.categoria || ""), String(busca.localizacao || ""));
      const lista = historico.get(chave) || [];
      lista.push({ total: Number(busca.total_resultados || 0), em: String(busca.created_at || "") });
      historico.set(chave, lista);
    }
    const alvosOrdenados = alvos.slice().sort((a, b) => {
      const ha = historico.get(chaveAlvo(a.nicho, a.cidade)) || [];
      const hb = historico.get(chaveAlvo(b.nicho, b.cidade)) || [];
      if (ha.length === 0 && hb.length > 0) return -1;
      if (hb.length === 0 && ha.length > 0) return 1;
      const ultimosA = ha.slice(0, 3);
      const ultimosB = hb.slice(0, 3);
      const rendimentoA = ultimosA.reduce((s, x) => s + x.total, 0) / Math.max(1, ultimosA.length);
      const rendimentoB = ultimosB.reduce((s, x) => s + x.total, 0) / Math.max(1, ultimosB.length);
      if (rendimentoA !== rendimentoB) return rendimentoB - rendimentoA;
      const ultimoA = ha[0]?.em || "";
      const ultimoB = hb[0]?.em || "";
      return ultimoA.localeCompare(ultimoB);
    });
    const alvo = alvosOrdenados[0] || SEMENTES[0];

    // Ajusta o lote pelo rendimento real do dia, sem ultrapassar o teto por execução.
    const rendimento = requisicoesHoje > 0 ? (confirmadosHoje ?? 0) / requisicoesHoje : 2.4;
    const faltam = Math.max(0, META_WHATSAPP_DIA - (confirmadosHoje ?? 0));
    const estimadasRestantes = Math.ceil(faltam / Math.max(0.5, rendimento));
    const limiteRun = Math.min(MAX_REQUISICOES_POR_RUN, restantesHoje, Math.max(6, estimadasRestantes));

    // ===== Busca no Google Maps =====
    const { data: busca, error: erroBusca } = await supabase.functions.invoke(
      "google-maps-buscar-leads",
      {
        body: {
          categoria: alvo.nicho,
          localizacao: alvo.cidade,
          max_resultados: cadastral ? REPOSICAO_CADASTRAL : MAX_RESULTADOS,
          ...(cadastral ? { owner_id: body.owner_id } : {}),
          somente_novos: true,
          origem: "resgate_engajamento",
          max_requisicoes: limiteRun,
        },
      },
    );
    if (erroBusca) {
      return json({ ok: false, alvo, error: String(erroBusca.message || erroBusca) }, 200);
    }

    // Verifica os números recém-captados junto com os pendentes antigos em uma
    // única varredura. Isso evita duas checagens UAZAPI simultâneas e também
    // elimina a falha de autorização observada na chamada específica por busca.
    const buscaId = (busca as any)?.busca_id || null;
    const { data: pendentesData, error: pendentesErr } = await supabase.functions.invoke(
      "google-maps-verificar-whatsapp",
      { body: { limite: 600 } },
    );

    if (cadastral) {
      // Capturing a phone never grants consent: fresh leads remain outside the send pool.
      const { data: novos, error: novosErro } = await supabase.from('google_maps_leads').select('id, nome, telefone, telefone_internacional, tem_whatsapp')
        .eq('busca_id', buscaId || '00000000-0000-0000-0000-000000000000').eq('user_id', body.owner_id).limit(REPOSICAO_CADASTRAL);
      if (novosErro) throw novosErro;
      const registros = (novos || []).filter((l: any) => l.tem_whatsapp && l.nome && String(l.telefone_internacional || l.telefone || '').replace(/\D/g, '').length >= 10)
        .map((l: any) => ({ user_id: body.owner_id, telefone_sufixo: String(l.telefone_internacional || l.telefone).replace(/\D/g, '').slice(-8),
          telefone: String(l.telefone_internacional || l.telefone).replace(/\D/g, ''), nome_empresa: l.nome, fonte: 'candidato', lead_id: l.id }));
      if (registros.length) {
        const { error: inserirErro } = await supabase.from('meta_recuperacao_cadastral_destinos').upsert(registros, { onConflict: 'user_id,telefone_sufixo', ignoreDuplicates: true });
        if (inserirErro) throw inserirErro;
      }
      const resultado = { ok: true, alvo: REPOSICAO_CADASTRAL, captados: novos?.length || 0, whatsapp_confirmado: registros.length,
        motivo: registros.length < REPOSICAO_CADASTRAL ? 'Lote encerrado sob limites de consultas, resultados e verificação' : 'Alvo atingido',
        aguardando_autorizacao: registros.length, busca_id: buscaId };
      await supabase.from('meta_recuperacao_cadastral_config').update({ reposicao_resultado: resultado }).eq('user_id', body.owner_id).eq('reposicao_token', body.reposicao_token);
      return json(resultado);
    }




    const { count: estoqueFinal } = await supabase
      .from("google_maps_leads")
      .select("id", { count: "exact", head: true })
      .eq("tem_whatsapp", true)
      .or(`usado_aquecimento_em.is.null,usado_aquecimento_em.lt.${carencia}`);

    const { count: confirmadosDepois } = await supabase
      .from("google_maps_leads")
      .select("id", { count: "exact", head: true })
      .eq("tem_whatsapp", true)
      .gte("created_at", inicioDia)
      .lte("created_at", fimDia);

    const consultasDepois = requisicoesHoje + Number((busca as any)?.requisicoes_places ?? 0);
    const provedorAtual = String((busca as any)?.provedor_utilizado ?? "");
    const trocouConta = !!provedorAtual && !((buscasHoje as any[]) || []).some((b) => b?.provedor_utilizado === provedorAtual);
    const marco = trocouConta
      ? `conta-${provedorAtual}`
      : (confirmadosDepois ?? 0) >= META_WHATSAPP_DIA
      ? "1000"
      : (confirmadosDepois ?? 0) >= 800
      ? "800"
      : consultasDepois >= Math.ceil(MAX_REQUISICOES_POR_DIA * 0.8)
      ? "80pct"
      : null;
    if (marco) {
      const titulo = marco.startsWith("conta-") ? "Conta Google Maps selecionada" : marco === "1000" ? "Meta diária alcançada" : marco === "800" ? "Captação chegou a 800" : "80% do teto diário consumido";
      await notificarNumeros(supabase, {
        tipo: "google_maps_captacao_marco",
        destinatarios: DESTINATARIOS_AVISO,
        chaveIdempotencia: `gm-captacao-${dia}-${marco}`,
        mensagem: `🗺️ *${titulo}*\n• ${(confirmadosDepois ?? 0)}/${META_WHATSAPP_DIA} contatos com WhatsApp confirmados hoje\n• ${consultasDepois}/${MAX_REQUISICOES_POR_DIA} consultas utilizadas\n• Estoque disponível: ${estoqueFinal ?? 0}`,
      });
    }

    return json({
      ok: true,
      alvo,
      estoque_antes: estoque ?? 0,
      estoque_depois: estoqueFinal ?? 0,
      confirmados_antes: confirmadosHoje ?? 0,
      confirmados_depois: confirmadosDepois ?? 0,
      meta_confirmados_dia: META_WHATSAPP_DIA,
      busca_id: buscaId,
      nicho_usado: alvo.nicho,
      verificacao_whatsapp: pendentesErr ? { erro: String(pendentesErr.message || pendentesErr) } : pendentesData,
      verificacao_pendentes: pendentesErr ? { erro: String(pendentesErr.message || pendentesErr) } : pendentesData,
      requisicoes_antes: requisicoesHoje,
      limite_requisicoes_run: limiteRun,
      limite_requisicoes_dia: MAX_REQUISICOES_POR_DIA,
    });
    } finally {
      await supabase.rpc("gm_abastecimento_release", { p_token: token });
    }
  } catch (e) {
    console.error("[google-maps-leads-abastecer]", e);
    return json({ ok: false, error: e instanceof Error ? e.message : "erro" }, 500);
  }
});
