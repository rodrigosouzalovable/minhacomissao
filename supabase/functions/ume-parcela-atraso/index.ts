// Atendente: localiza a próxima parcela em aberto (preferindo a atrasada) do acordo
// ativo UME/Odres do CPF e gera o PIX/boleto atualizado pela API oficial da UME.
// Não envia nada: o atendente aprova o envio na tela.
import { requireCaller, callerCanAccessUmeCpf, asCaller } from '../_shared/auth-guard.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import { umeApi, type UmeAmbiente } from '../_shared/ume-api.ts';
import { traduzirErroUme } from '../_shared/ume-erros.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const Body = z.object({ cpf: z.string().min(11).max(14) });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const caller = await requireCaller(req, { user: 'staff' });
  if (caller instanceof Response) return caller;
  try {
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
    const cpf = parsed.data.cpf.replace(/\D/g, '');
    if (cpf.length !== 11) return json({ error: 'CPF inválido' }, 400);
    if (!(await callerCanAccessUmeCpf(caller, cpf))) return json({ success: false, message: 'Sem permissão para este cliente' }, 403);

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const rls = asCaller(caller);
    const fmtCpf = `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
    const { data: acordos } = await rls.from('acordos').select('id, cliente_nome, criado_em')
      .in('cliente_cpf', [cpf, fmtCpf]).eq('status', 'ativo').order('criado_em', { ascending: false }).limit(1);
    const acordo = acordos?.[0];
    if (!acordo) return json({ success: false, message: 'Nenhum acordo ativo encontrado para este CPF.' });

    const { data: parcelas } = await rls.from('pagamentos').select('numero_parcela, valor_parcela, data_prevista, status')
      .eq('acordo_id', acordo.id).order('numero_parcela', { ascending: true });
    const lista = parcelas || [];
    const abertas = lista.filter((p: any) => p.status !== 'pago');
    if (!abertas.length) return json({ success: false, message: 'Todas as parcelas deste acordo constam como pagas.' });
    const hoje = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
    const parcela: any = abertas[0];
    const atrasada = String(parcela.data_prevista) < hoje;

    const { data: cli } = await db.from('ume_carteira_clientes').select('borrower_id').eq('cpf', cpf).maybeSingle();
    if (!cli?.borrower_id) return json({ success: false, message: 'Cadastro do cliente na UME não encontrado (SFTP).' });

    const venc = atrasada ? hoje : String(parcela.data_prevista);
    const ambiente: UmeAmbiente = Deno.env.get('UME_PRD_LIBERADO') === 'true' ? 'prd' : 'dev';
    const r = await umeApi.gerarBoletoUnico(ambiente, String(cli.borrower_id), venc);
    if (!r.ok) {
      const msg = String((r.data as any)?.message || (r.data as any)?.error || `ume_http_${r.status}`);
      return json({ success: false, message: traduzirErroUme(msg, 'a atualização da parcela') });
    }
    const d = (r.data ?? {}) as Record<string, unknown>;
    const boleto = {
      invoiceId: String(d.id ?? ''), valor: Number(d.invoiceTotalValue ?? 0) || null,
      vencimento: String(d.invoiceDueDate ?? venc).slice(0, 10), pixCode: String(d.pixCode ?? ''),
      invoiceUrl: String(d.invoiceUrl ?? ''), pixQrCodeUrl: String(d.pixQrCodeUrl ?? ''), ambiente,
    };
    if (!boleto.pixCode && !boleto.invoiceUrl) return json({ success: false, message: 'A UME não devolveu PIX nem boleto.' });
    await db.from('ume_boleto_log').insert({ user_id: caller.userId, cpf, borrower_id: String(cli.borrower_id), invoice_id: boleto.invoiceId || null, valor: boleto.valor, vencimento: boleto.vencimento, invoice_url: boleto.invoiceUrl || null, origem: 'atendente', ambiente });

    return json({
      success: true, boleto, atrasada, nome: acordo.cliente_nome,
      parcela: { numero: parcela.numero_parcela, total: lista.length, valorOriginal: parcela.valor_parcela, vencimentoOriginal: parcela.data_prevista },
    });
  } catch (e) {
    console.error('[ume-parcela-atraso]', String((e as Error)?.message || e));
    return json({ success: false, message: 'Não foi possível atualizar a parcela agora.' });
  }
});
