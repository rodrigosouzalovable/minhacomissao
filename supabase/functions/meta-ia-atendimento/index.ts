// Atendimento automático com IA nas conversas da caixa "IA" do Inbox Meta Oficial.
// Fluxo: identifica CPF -> se já tem acordo, chama humano; se não tem, envia proposta calculada.
// A IA nunca cria acordo: ao escolher à vista/parcelado, avisa os contatos de emergência.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);

const soDigitos = (v: unknown) => String(v ?? '').replace(/\D/g, '');
const sufixo8 = (v: unknown) => soDigitos(v).slice(-8);

const primeiroNome = (nome?: string | null) => {
  const p = String(nome || '').trim().split(/\s+/)[0] || '';
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : 'tudo bem';
};

const cpfFormatado = (cpf: string) => {
  const d = soDigitos(cpf);
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return d;
};

function validaCpfCnpj(doc: string): boolean {
  const d = soDigitos(doc);
  return d.length === 11 || d.length === 14;
}

function agoraSP(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
}

function render(tpl: string, vars: Record<string, string>): string {
  return String(tpl || '').replace(/\{([a-z0-9_]+)\}/gi, (m, k) => (vars[String(k).toLowerCase()] ?? m));
}

// Extrai CPF/CNPJ tolerando máscara, espaços e texto ao redor ("meu cpf é 123.456.789-09")
function extrairDoc(texto: string): string {
  const t = String(texto || '');
  const candidatos = t.match(/(?:\d[\s.\-\/]*){11,14}/g) || [];
  for (const c of candidatos) {
    const d = soDigitos(c);
    if (d.length === 11 || d.length === 14) return d;
  }
  const todos = soDigitos(t);
  if (todos.length === 11 || todos.length === 14) return todos;
  return '';
}

// Detecta intenção sem IA externa (rápido e barato). IA só é usada como fallback.
function intencaoLocal(texto: string): 'avista' | 'parcelado' | 'cpf' | 'outro' {
  const t = String(texto || '').toLowerCase();
  if (extrairDoc(t)) return 'cpf';
  if (/(a\s*vista|à\s*vista|avista|quitar|quita[çc][ãa]o|uma\s*vez|1x)/.test(t)) return 'avista';
  if (/(parcel|dividir|vezes|\d+\s*x|boleto\s*mensal)/.test(t)) return 'parcelado';
  return 'outro';
}


async function enviarTexto(supabase: any, instanciaId: string, telefone: string | null, bsuid: string | null, texto: string) {
  const { data, error } = await supabase.functions.invoke('send-whatsapp-meta-text', {
    body: { instancia_id: instanciaId, telefone: telefone || undefined, bsuid: bsuid || undefined, texto },
  });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error || 'falha no envio');
  return data;
}

async function avisarEmergencia(supabase: any, mensagem: string) {
  const { data: contatos } = await supabase
    .from('meta_ia_contatos_emergencia')
    .select('telefone, nome')
    .eq('ativo', true);
  for (const c of (contatos || [])) {
    try {
      await supabase.functions.invoke('send-whatsapp', {
        body: { telefone: (c as any).telefone, mensagem },
      });
    } catch (e: any) {
      console.error('[MetaIA] falha ao avisar emergência', (c as any).telefone, e?.message || e);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    const { contato_id, texto } = await req.json();
    if (!contato_id) return json({ success: false, error: 'contato_id é obrigatório' }, 400);

    // ===== Contato / caixa =====
    const { data: contato } = await supabase
      .from('meta_whatsapp_contatos')
      .select('id, instancia_id, telefone, bsuid, nome, folder_id')
      .eq('id', contato_id)
      .maybeSingle();
    if (!contato) return json({ success: false, error: 'contato não encontrado' }, 404);

    const folderId: string | null = (contato as any).folder_id ?? null;

    // ===== Config: linha da caixa específica, senão a global =====
    const { data: cfgs } = await supabase.from('meta_ia_config').select('*');
    const cfg = (cfgs || []).find((c: any) => c.folder_id === folderId)
      || (cfgs || []).find((c: any) => !c.folder_id);
    if (!cfg) return json({ success: false, skipped: 'sem configuração' });

    // Só atua na caixa configurada (folder_id da config global = null => precisa de folder alvo explícito)
    const { data: folderIA } = folderId
      ? await supabase.from('meta_inbox_folders').select('id, nome').eq('id', folderId).maybeSingle()
      : { data: null } as any;
    const nomeCaixa = String((folderIA as any)?.nome || '').trim().toUpperCase();
    if (!cfg.folder_id && nomeCaixa !== 'IA') {
      return json({ success: false, skipped: 'conversa fora da caixa IA' });
    }
    if (!cfg.ativo) return json({ success: false, skipped: 'IA desligada' });

    // ===== Estado da conversa =====
    const hojeSP = agoraSP().toISOString().slice(0, 10);
    let { data: estado } = await supabase
      .from('meta_ia_conversas_estado')
      .select('*')
      .eq('contato_id', contato_id)
      .maybeSingle();

    if (!estado) {
      const { data: novo } = await supabase
        .from('meta_ia_conversas_estado')
        .insert({ contato_id, telefone: (contato as any).telefone || '', etapa: 'inicio' })
        .select('*')
        .maybeSingle();
      estado = novo;
    }
    if (!estado) return json({ success: false, error: 'falha ao criar estado' }, 500);

    if (estado.aguardando_humano) return json({ success: true, skipped: 'aguardando humano' });

    // Limite anti-loop por dia
    const msgsHoje = estado.msgs_dia === hojeSP ? estado.msgs_hoje : 0;
    if (msgsHoje >= (cfg.limite_msgs_dia ?? 20)) {
      return json({ success: true, skipped: 'limite diário atingido' });
    }

    // Um humano já respondeu essa conversa DEPOIS do último envio da IA? => IA não atropela
    const corteHumano: string = String(estado.contexto?.ultimo_envio_ia || estado.created_at);
    const { data: saidaHumana } = await supabase
      .from('meta_whatsapp_mensagens')
      .select('id, conteudo')
      .eq('instancia_id', (contato as any).instancia_id)
      .eq('telefone', (contato as any).telefone || '')
      .eq('direcao', 'saida')
      .gt('criado_em', corteHumano)
      .limit(1);
    if ((saidaHumana || []).length > 0 && estado.etapa !== 'inicio') {
      await supabase.from('meta_ia_conversas_estado')
        .update({ aguardando_humano: true }).eq('id', estado.id);
      console.log('[MetaIA] humano assumiu', { contato_id });
      return json({ success: true, skipped: 'humano assumiu' });
    }


    // ===== Horário de atendimento =====
    const hora = agoraSP().getHours();
    const { data: templates } = await supabase.from('meta_ia_templates').select('etapa, template, ativo');
    const tpl = (etapa: string) => {
      const t = (templates || []).find((x: any) => x.etapa === etapa && x.ativo !== false);
      return t ? String((t as any).template) : '';
    };

    const enviar = async (texto: string, novaEtapa: string, extra: Record<string, unknown> = {}) => {
      if (!texto.trim()) return;
      await enviarTexto(supabase, (contato as any).instancia_id, (contato as any).telefone, (contato as any).bsuid, texto);
      await supabase.from('meta_ia_conversas_estado').update({
        etapa: novaEtapa,
        msgs_dia: hojeSP,
        msgs_hoje: msgsHoje + 1,
        ultima_msg_em: new Date().toISOString(),
        contexto: { ...(estado.contexto || {}), ultimo_envio_ia: new Date().toISOString() },
        ...extra,
      }).eq('id', estado.id);
    };

    if (hora < (cfg.hora_inicio ?? 8) || hora >= (cfg.hora_fim ?? 20)) {
      if (estado.etapa === 'fora_horario') return json({ success: true, skipped: 'já avisou fora de horário' });
      await enviar(tpl('fora_horario'), 'fora_horario');
      return json({ success: true, etapa: 'fora_horario' });
    }

    // ===== Identificação do CPF =====
    let cpf: string = estado.cpf || '';
    const suf = sufixo8((contato as any).telefone);

    if (!cpf && suf.length === 8) {
      const { data: devs } = await supabase
        .from('devedores')
        .select('cpf, nome, criado_em')
        .eq('ativo', true)
        .ilike('telefone', `%${suf}`)
        .order('criado_em', { ascending: false })
        .limit(1);
      if ((devs || []).length) cpf = soDigitos((devs as any)[0].cpf);

      if (!cpf) {
        const { data: tels } = await supabase
          .from('devedor_telefones')
          .select('devedor_cpf')
          .eq('ativo', true)
          .ilike('numero', `%${suf}`)
          .limit(1);
        if ((tels || []).length) cpf = soDigitos((tels as any)[0].devedor_cpf);
      }
    }

    // CPF vindo na mensagem do cliente
    const intencao = intencaoLocal(texto || '');
    if (!cpf && intencao === 'cpf') {
      const doc = soDigitos(texto);
      if (validaCpfCnpj(doc)) cpf = doc;
    }

    if (!cpf) {
      const digitos = soDigitos(texto);
      if (digitos.length > 0 && !validaCpfCnpj(digitos) && estado.etapa === 'pedir_cpf') {
        await enviar(tpl('cpf_invalido'), 'pedir_cpf');
        return json({ success: true, etapa: 'cpf_invalido' });
      }
      if (estado.etapa === 'pedir_cpf' && (estado.msgs_hoje ?? 0) > 0 && !digitos.length) {
        await enviar(tpl('cpf_invalido'), 'pedir_cpf');
        return json({ success: true, etapa: 'cpf_invalido' });
      }
      await enviar(tpl('pedir_cpf'), 'pedir_cpf');
      return json({ success: true, etapa: 'pedir_cpf' });
    }

    // ===== Já tem acordo lançado? =====
    const { data: temAcordo } = await supabase.rpc('cpf_has_acordo', { p_cpf: cpf });
    if (temAcordo === true) {
      let atendente = '';
      try {
        const { data: at } = await supabase.rpc('cpf_acordo_funcionario_nome', { p_cpf: cpf });
        atendente = String(at || '');
      } catch { /* opcional */ }

      const { data: dev } = await supabase
        .from('devedores')
        .select('nome')
        .ilike('cpf', `%${cpf.slice(-6)}%`)
        .limit(1);
      const nomeCli = (contato as any).nome || (dev as any)?.[0]?.nome || '';

      await enviar(render(tpl('ja_tem_acordo'), {
        primeiro_nome: primeiroNome(nomeCli),
        cpf_formatado: cpfFormatado(cpf),
      }), 'aguardando_humano', { cpf, aguardando_humano: true });

      await avisarEmergencia(supabase,
        `🤖 *IA — atendimento humano necessário*\n\n` +
        `Cliente: ${nomeCli || '(sem nome)'}\n` +
        `Telefone: ${(contato as any).telefone || (contato as any).bsuid}\n` +
        `CPF: ${cpfFormatado(cpf)}\n` +
        `Motivo: já possui acordo lançado${atendente ? ` (atendente: ${atendente})` : ''}\n\n` +
        `Assuma a negociação no Inbox Meta Oficial (caixa IA).`);

      return json({ success: true, etapa: 'ja_tem_acordo' });
    }

    // ===== Débitos e proposta =====
    const { data: debitos } = await supabase.rpc('consultar_debitos_por_cpf', { p_cpf: cpf });
    const lista = (debitos || []) as any[];
    if (!lista.length) {
      await enviar(tpl('sem_debitos'), 'sem_debitos', { cpf });
      return json({ success: true, etapa: 'sem_debitos' });
    }

    const total = lista.reduce((s, d) => s + Number(d.valor_atualizado || d.valor_original || 0), 0);
    const credor = String(lista[0]?.credor || 'o credor');
    const nomeCli = String(lista[0]?.nome || (contato as any).nome || '');

    const descAvista = Number(cfg.desconto_avista_pct ?? 50);
    const descParc = Number(cfg.desconto_parcelado_pct ?? 30);
    const maxParc = Number(cfg.max_parcelas ?? 24);
    const parcMin = Number(cfg.parcela_minima ?? 100);

    const valorAvista = total * (1 - descAvista / 100);
    const valorParcelado = total * (1 - descParc / 100);
    let parcelas = 1;
    for (let i = maxParc; i >= 1; i--) {
      if (valorParcelado / i >= parcMin) { parcelas = i; break; }
    }
    const valorParcela = valorParcelado / parcelas;

    const vars: Record<string, string> = {
      primeiro_nome: primeiroNome(nomeCli),
      nome_completo: nomeCli,
      cpf_formatado: cpfFormatado(cpf),
      credor,
      valor_total: fmtBRL(total),
      valor_avista: fmtBRL(valorAvista),
      desconto_avista_pct: String(descAvista),
      desconto_parcelado_pct: String(descParc),
      max_parcelas: String(parcelas),
      valor_parcela: fmtBRL(valorParcela),
      valor_parcelado: fmtBRL(valorParcelado),
      telefone_contato: '(62) 98218-3144',
    };

    // Cliente escolheu uma opção => confirma e chama humano para fechar
    if (estado.etapa === 'proposta' && (intencao === 'avista' || intencao === 'parcelado')) {
      await enviar(render(tpl('confirmacao_escolha'), vars), 'aguardando_humano', {
        cpf, aguardando_humano: true, contexto: { ...(estado.contexto || {}), escolha: intencao },
      });
      await avisarEmergencia(supabase,
        `🤖 *IA — cliente aceitou proposta*\n\n` +
        `Cliente: ${nomeCli || '(sem nome)'}\n` +
        `Telefone: ${(contato as any).telefone || (contato as any).bsuid}\n` +
        `CPF: ${cpfFormatado(cpf)}\n` +
        `Credor: ${credor}\n` +
        `Opção escolhida: ${intencao === 'avista' ? `à vista ${vars.valor_avista}` : `${parcelas}x de ${vars.valor_parcela}`}\n\n` +
        `Finalize o acordo e envie o boleto.`);
      return json({ success: true, etapa: 'confirmacao_escolha' });
    }

    // Já enviou proposta e o cliente mandou outra coisa (dúvida) => chama humano
    if (estado.etapa === 'proposta') {
      await avisarEmergencia(supabase,
        `🤖 *IA — dúvida do cliente*\n\n` +
        `Telefone: ${(contato as any).telefone || (contato as any).bsuid}\n` +
        `CPF: ${cpfFormatado(cpf)}\n` +
        `Mensagem: "${String(texto || '').slice(0, 300)}"\n\n` +
        `Assuma a conversa na caixa IA.`);
      await supabase.from('meta_ia_conversas_estado')
        .update({ aguardando_humano: true, cpf }).eq('id', estado.id);
      return json({ success: true, etapa: 'duvida_humano' });
    }

    await enviar(render(tpl('proposta'), vars), 'proposta', { cpf });
    return json({ success: true, etapa: 'proposta', total, parcelas });
  } catch (e: any) {
    console.error('[MetaIA] erro', e?.message || e);
    return json({ success: false, error: String(e?.message || e) }, 500);
  }
});
