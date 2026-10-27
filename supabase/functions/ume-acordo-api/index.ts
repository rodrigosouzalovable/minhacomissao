// Acordo parcelado UME pela API oficial (/renegotiations), usando os installmentIds
// gravados pelos arquivos diários do SFTP. Efetivar exige simulação prévia e confirmação explícita.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import { umeApi, type UmeAmbiente } from '../_shared/ume-api.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const cpfZ = z.string().transform((v) => v.replace(/\D/g, '').padStart(11, '0')).refine((v) => v.length === 11, 'CPF inválido');
const Body = z.discriminatedUnion('acao', [
  z.object({ acao: z.literal('carregar'), cpf: cpfZ }),
  z.object({
    acao: z.enum(['simular', 'efetivar']),
    cpf: cpfZ,
    numeroParcelas: z.number().int().min(1).max(24),
    primeiroVencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    desconto: z.number().min(0),
    juros: z.number().min(0).max(8).default(0),
    totalAlvo: z.number().positive().optional(),
    confirmar: z.boolean().optional(),
    conversaId: z.string().uuid().nullish(),
  }),
]);

const round2 = (v: number) => Math.round(v * 100) / 100;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'não autenticado' }, 401);
    const { data: u } = await db.auth.getUser(jwt);
    if (!u?.user) return json({ error: 'não autenticado' }, 401);

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
    const b = parsed.data;

    const { data: cli } = await db.from('ume_carteira_clientes').select('borrower_id, nome, carteira, data_lote').eq('cpf', b.cpf).maybeSingle();
    if (!cli?.borrower_id) {
      const hojeLog = new Date().toISOString().slice(0, 10);
      await db.from('ume_acordo_api_log').insert({
        user_id: u.user.id, cpf: b.cpf, borrower_id: '', ambiente: 'prd', acao: b.acao, parcelas: 0,
        primeiro_vencimento: hojeLog, desconto: 0, juros: 0, installment_ids: [], sucesso: false,
        resposta: { motivo: 'fora_da_carteira' } as never,
      }).then(() => {}, () => {});
      return json({ success: false, error: 'cpf_fora_da_carteira', message: 'Este CPF não veio no arquivo UME/Odres de hoje. Normalmente isso acontece quando a UME ainda considera aberta uma renegociação antiga (mesmo quebrada). Peça à UME para encerrá-la ou lance o acordo pelo + da conversa.' });
    }
    const { data: parc } = await db.from('ume_carteira_parcelas')
      .select('installment_id, contrato, vencimento, valor')
      .eq('cpf', b.cpf).eq('carteira', cli.carteira).order('vencimento').limit(500);
    const parcelas = parc ?? [];
    const totalAberto = round2(parcelas.reduce((s, p) => s + Number(p.valor ?? 0), 0));

    if (b.acao === 'carregar') {
      return json({ success: true, cliente: { borrowerId: String(cli.borrower_id), nome: cli.nome, carteira: cli.carteira, dataLote: cli.data_lote }, parcelas, totalAberto });
    }

    if (!parcelas.length) return json({ success: false, error: 'sem_parcelas', message: 'Nenhuma parcela em aberto deste CPF no último arquivo.' });
    if (!b.totalAlvo && b.desconto > totalAberto) return json({ success: false, error: 'desconto_maior_que_divida', message: 'O desconto é maior que o total em aberto.' });
    const hoje = new Date().toISOString().slice(0, 10);
    if (b.primeiroVencimento < hoje) return json({ success: false, error: 'vencimento_passado', message: 'O 1º vencimento não pode ser no passado.' });
    if (b.acao === 'efetivar' && b.confirmar !== true) return json({ error: 'confirmação obrigatória' }, 400);

    const ambiente: UmeAmbiente = Deno.env.get('UME_PRD_LIBERADO') === 'true' ? 'prd' : 'dev';
    const ids = parcelas.map((p) => String(p.installment_id));
    const corpo = {
      borrowerId: String(cli.borrower_id),
      installmentsIds: ids,
      monetaryDiscount: round2(b.desconto),
      firstPaymentDueDate: b.primeiroVencimento,
      numberOfPayments: b.numeroParcelas,
      interestRate: b.juros,
    };
    // Total combinado com o cliente: a UME atualiza a dívida com encargos de atraso,
    // então lemos o totalDebt atualizado e enviamos a diferença como desconto, sem juros.
    if (b.totalAlvo && b.totalAlvo > 0) {
      const base = await umeApi.simularRenegociacao(ambiente, { ...corpo, monetaryDiscount: 0, interestRate: 0 });
      const totalDebt = Number((base.data as Record<string, unknown> | null)?.totalDebt);
      if (!base.ok || !Number.isFinite(totalDebt)) {
        const d = base.data as Record<string, unknown> | null;
        return json({ success: false, error: 'ume_base', message: 'A UME recusou: ' + String(d?.message || d?.error || `erro ${base.status}`), detalhe: base.data });
      }
      if (b.totalAlvo > totalDebt) {
        return json({ success: false, error: 'total_acima_divida', message: `O total combinado é maior que a dívida atualizada na UME (${totalDebt.toFixed(2)}).` });
      }
      corpo.monetaryDiscount = round2(totalDebt - b.totalAlvo);
      corpo.interestRate = 0;
    }
    const r = b.acao === 'simular' ? await umeApi.simularRenegociacao(ambiente, corpo) : await umeApi.fecharAcordo(ambiente, corpo);
    console.log('[ume-acordo-api]', { acao: b.acao, ambiente, status: r.status, parcelas: ids.length });

    await db.from('ume_acordo_api_log').insert({
      user_id: u.user.id, cpf: b.cpf, borrower_id: corpo.borrowerId, conversa_id: b.conversaId ?? null,
      ambiente, acao: b.acao, parcelas: b.numeroParcelas, primeiro_vencimento: b.primeiroVencimento,
      desconto: corpo.monetaryDiscount, juros: corpo.interestRate, installment_ids: ids, sucesso: r.ok, resposta: r.data as never,
    });

    if (!r.ok) {
      const d = r.data as Record<string, unknown> | null;
      return json({ success: false, error: String(d?.message || d?.error || `ume_http_${r.status}`), message: 'A UME recusou: ' + String(d?.message || d?.error || `erro ${r.status}`), detalhe: r.data });
    }
    return json({ success: true, ambiente, totalAberto, resultado: r.data });
  } catch (e) {
    const msg = String((e as Error)?.message || e);
    console.error('[ume-acordo-api] erro', msg);
    return json({ success: false, error: msg, message: 'Falha ao falar com a UME. Tente novamente.' });
  }
});
