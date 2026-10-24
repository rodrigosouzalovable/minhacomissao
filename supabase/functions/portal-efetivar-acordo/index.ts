// Autoatendimento público do portal (UME / Odres Cred): o cliente confirma a condição,
// o acordo é fechado na UME, o PIX/boleto da 1ª parcela é emitido e o acordo é lançado
// no login do administrador, que recebe aviso no WhatsApp. Qualquer recusa devolve
// fallback:true para o portal oferecer o WhatsApp com a proposta pronta.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3.23.8';
import { umeApi, type UmeAmbiente } from '../_shared/ume-api.ts';
import { consultarUme } from '../_shared/ume-desconto.ts';
import { notificarAdmin } from '../_shared/notificar-admin.ts';

const ADMIN_USER_ID = 'ee649720-b8ce-47a2-859e-100a3a9ae6bb';
const CARTEIRA: Record<'ume' | 'odres_cred', string> = { ume: '201845262', odres_cred: '217490215' };
const json = (b: unknown) => new Response(JSON.stringify(b), { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const fallback = (message: string, motivo: string) => json({ success: false, fallback: true, motivo, message });
const r2 = (v: number) => Math.round(v * 100) / 100;
const money = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const br = (d: string) => d.split('-').reverse().join('/');
const addMonths = (d: string, n: number) => { const [y, m, day] = d.split('-').map(Number); const dt = new Date(Date.UTC(y, m - 1 + n, 1)); const last = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate(); dt.setUTCDate(Math.min(day, last)); return dt.toISOString().slice(0, 10); };
const pctComissao = (d: number) => d <= 0 ? 0 : d <= 60 ? 2 : d <= 90 ? 3 : d <= 180 ? 4 : d <= 360 ? 5 : d <= 720 ? 7 : 9;

const Body = z.object({
  cpf: z.string().transform((v) => v.replace(/\D/g, '')).refine((v) => v.length === 11),
  credor: z.enum(['ume', 'odres_cred']),
  modo: z.enum(['avista', 'parcelado']),
  parcelas: z.number().int().min(1).max(18),
  primeiroVencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  telefone: z.string().transform((v) => v.replace(/\D/g, '')).refine((v) => v.length >= 10 && v.length <= 13),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const NAO = 'Não conseguimos concluir seu acordo automaticamente. Fale com nossa equipe no WhatsApp para formalizar esta proposta.';
  try {
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ success: false, message: 'Confira os dados informados.' });
    const b = parsed.data;
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const db = createClient(Deno.env.get('SUPABASE_URL')!, key, { auth: { persistSession: false } });

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const dig = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${key}:portal-efetivar:${ip}:${b.cpf}`));
    const chave = Array.from(new Uint8Array(dig), (v) => v.toString(16).padStart(2, '0')).join('');
    const { data: ok } = await db.rpc('portal_reservar_consulta', { p_chave: chave });
    if (ok !== true) return json({ success: false, message: 'Muitas tentativas em pouco tempo. Aguarde alguns minutos.' });

    // Data: hoje até +10 dias (BRT)
    const hoje = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
    const max = new Date(Date.parse(`${hoje}T00:00:00Z`) + 10 * 86400000).toISOString().slice(0, 10);
    if (b.primeiroVencimento < hoje || b.primeiroVencimento > max) return json({ success: false, message: 'Escolha uma data entre hoje e os próximos 10 dias.' });

    // Já existe acordo ativo na nossa base → atendimento humano
    const { data: ativos } = await db.from('acordos').select('id').eq('cliente_cpf', b.cpf).eq('status', 'ativo').limit(1);
    if (ativos?.length) return fallback('Já existe uma negociação em andamento para o seu CPF. Fale com nossa equipe para formalizar a nova proposta.', 'acordo_existente');

    const { data: cli } = await db.from('ume_carteira_clientes').select('borrower_id, nome, carteira').eq('cpf', b.cpf).maybeSingle();
    if (!cli?.borrower_id || cli.carteira !== CARTEIRA[b.credor]) return fallback(NAO, 'fora_carteira');
    const { data: parc } = await db.from('ume_carteira_parcelas').select('installment_id, vencimento').eq('cpf', b.cpf).eq('carteira', cli.carteira).order('vencimento').limit(500);
    if (!parc?.length) return fallback(NAO, 'sem_parcelas');

    // Principal recalculado no servidor (nunca confia no valor do navegador)
    const consulta = await consultarUme(db, b.cpf, { perfil: 'essencial', horasCache: 12, aguardarCache: true });
    const principal = Number(consulta?.valorSemJuros);
    if (!Number.isFinite(principal) || principal <= 0) return fallback(NAO, 'sem_principal');
    const total = b.modo === 'avista' ? r2(principal) : r2(principal * 1.1);
    const n = b.modo === 'avista' ? 1 : b.parcelas;
    if (b.modo === 'parcelado' && (n < 2 || Math.floor(Math.round(total * 100) / n) < 10000)) return json({ success: false, message: 'Cada parcela precisa ser de pelo menos R$ 100.' });

    const ambiente: UmeAmbiente = Deno.env.get('UME_PRD_LIBERADO') === 'true' ? 'prd' : 'dev';
    const corpo = { borrowerId: String(cli.borrower_id), installmentsIds: parc.map((p) => String(p.installment_id)), monetaryDiscount: 0, firstPaymentDueDate: b.primeiroVencimento, numberOfPayments: n, interestRate: 0 };
    const base = await umeApi.simularRenegociacao(ambiente, corpo);
    const totalDebt = Number((base.data as Record<string, unknown> | null)?.totalDebt);
    if (!base.ok || !Number.isFinite(totalDebt) || total > totalDebt) {
      console.log('[portal-efetivar] simulação recusada', base.status);
      return fallback(NAO, 'ume_simulacao');
    }
    corpo.monetaryDiscount = r2(totalDebt - total);
    const fechado = await umeApi.fecharAcordo(ambiente, corpo);
    await db.from('ume_acordo_api_log').insert({ user_id: ADMIN_USER_ID, cpf: b.cpf, borrower_id: corpo.borrowerId, ambiente, acao: 'efetivar', parcelas: n, primeiro_vencimento: b.primeiroVencimento, desconto: corpo.monetaryDiscount, juros: 0, installment_ids: corpo.installmentsIds, sucesso: fechado.ok, resposta: { origem: 'portal', ...(fechado.data as object ?? {}) } as never });
    if (!fechado.ok) {
      console.log('[portal-efetivar] fechamento recusado', fechado.status, JSON.stringify(fechado.data).slice(0, 300));
      return fallback('Identificamos uma negociação anterior para o seu CPF que precisa ser liberada pela nossa equipe. Fale conosco no WhatsApp para formalizar esta proposta.', 'ume_fechamento');
    }

    // PIX/boleto da 1ª parcela
    const bol = await umeApi.gerarBoletoUnico(ambiente, corpo.borrowerId, b.primeiroVencimento);
    const d = (bol.data ?? {}) as Record<string, unknown>;
    const boleto = bol.ok ? { valor: Number(d.invoiceTotalValue ?? 0) || null, vencimento: String(d.invoiceDueDate ?? b.primeiroVencimento), pixCode: String(d.pixCode ?? ''), invoiceUrl: String(d.invoiceUrl ?? ''), pixQrCodeUrl: String(d.pixQrCodeUrl ?? ''), barcode: String(d.barcode ?? '') } : null;
    if (bol.ok) await db.from('ume_boleto_log').insert({ user_id: ADMIN_USER_ID, cpf: b.cpf, borrower_id: corpo.borrowerId, invoice_id: String(d.id ?? '') || null, valor: boleto!.valor, vencimento: boleto!.vencimento, invoice_url: boleto!.invoiceUrl || null, origem: 'atendente', ambiente });

    // Lançamento no login do administrador
    const dias = Math.max(1, Math.floor((Date.parse(`${hoje}T00:00:00Z`) - Date.parse(`${parc[0].vencimento}T00:00:00Z`)) / 86400000));
    const pct = pctComissao(dias);
    const cents = Math.round(total * 100), each = Math.floor(cents / n);
    const valores = Array.from({ length: n }, (_, i) => (i === n - 1 ? cents - each * (n - 1) : each) / 100);
    const nome = String(cli.nome || consulta?.nome || 'CLIENTE').toUpperCase();
    const label = b.credor === 'ume' ? 'UME' : 'Odres Cred';
    let acordoId: string | null = null;
    const { data: acordo, error } = await db.from('acordos').insert({
      user_id: ADMIN_USER_ID, cliente_nome: nome, cliente_cpf: b.cpf, cliente_telefone: b.telefone,
      valor_total: total, parcelas: n, valor_parcela: valores[0], data_primeiro_pagamento: b.primeiroVencimento,
      dias_atraso: dias, percentual_comissao: pct, comissao_total: r2(valores.reduce((s, v) => s + v * pct / 100, 0)),
      observacoes: `Acordo fechado pelo cliente no portal (${label}) — ${ambiente.toUpperCase()}${boleto ? ' — PIX/boleto emitido' : ' — boleto pendente'}`,
      empresa: b.credor === 'ume' ? 'ume_novo_mundo' : 'odres_cred', boleto_enviado: !!boleto, termo_formalizacao_status: 'pendente',
    }).select('id').single();
    if (error) console.error('[portal-efetivar] lançamento', error.message);
    else {
      acordoId = acordo.id;
      const { error: e2 } = await db.from('pagamentos').insert(valores.map((v, i) => ({ acordo_id: acordo.id, numero_parcela: i + 1, data_prevista: addMonths(b.primeiroVencimento, i), valor_parcela: v, comissao_parcela: r2(v * pct / 100), status: 'pendente' })));
      if (e2) console.error('[portal-efetivar] parcelas', e2.message);
    }

    const cpfFmt = b.cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    await notificarAdmin(db, {
      tipo: 'portal_acordo_emitido',
      chaveIdempotencia: `portal-acordo:${b.cpf}:${hoje}:${n}:${total}`,
      umaVezPorChave: true,
      mensagem: [
        '🔔 *Novo acordo fechado pelo portal!*', '',
        `👤 Cliente: ${nome}`, `📄 CPF: ${cpfFmt}`, `📱 Telefone: ${b.telefone}`, `🏦 Credor: ${label}`,
        `💰 Negociação: ${n === 1 ? `À vista ${money(total)}` : `${n}x de ${money(valores[0])}${valores[n - 1] !== valores[0] ? ` (última ${money(valores[n - 1])})` : ''} — total ${money(total)}`}`,
        `📌 Principal: ${money(r2(principal))}`, `📅 1º vencimento: ${br(b.primeiroVencimento)}`, `⏱️ Atraso: ${dias} dias (comissão ${pct}%)`,
        `⚡ ${boleto ? 'PIX/boleto da 1ª parcela emitido e exibido ao cliente.' : '⚠️ Acordo fechado, mas o boleto NÃO foi emitido — gerar manualmente.'}`,
        acordoId ? '✅ Lançado no seu login em Meus Acordos.' : '⚠️ Falha ao lançar em Meus Acordos — lançar manualmente.',
      ].join('\n'),
    }).catch((e) => console.error('[portal-efetivar] aviso', String(e)));

    return json({ success: true, nome, credor: label, total, parcelas: valores, primeiroVencimento: b.primeiroVencimento, boleto });
  } catch (e) {
    console.error('[portal-efetivar] erro', String((e as Error)?.message || e));
    return fallback(NAO, 'erro');
  }
});
