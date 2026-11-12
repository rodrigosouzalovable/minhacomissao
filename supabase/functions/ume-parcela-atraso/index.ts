// Atendente: localiza a próxima parcela em aberto (preferindo a atrasada) do acordo
// ativo UME/Odres do CPF e gera o PIX/boleto atualizado pela API oficial da UME.
// Não envia nada: o atendente aprova o envio na tela.
import { requireCaller, callerCanAccessUmeCpf, asCaller } from '../_shared/auth-guard.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import { umeApi, type UmeAmbiente } from '../_shared/ume-api.ts';
import { traduzirErroUme } from '../_shared/ume-erros.ts';
import { consultarUme } from '../_shared/ume-desconto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const Body = z.object({ cpf: z.string().min(11).max(14), vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const caller = await requireCaller(req, { user: 'any' });
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
    const hoje = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
    const escolhido = parsed.data.vencimento;
    if (escolhido && escolhido < hoje) return json({ success: false, message: 'A data de vencimento não pode ser anterior a hoje.' });
    const ambiente: UmeAmbiente = Deno.env.get('UME_PRD_LIBERADO') === 'true' ? 'prd' : 'dev';
    const { data: cliSftp } = await db.from('ume_carteira_clientes').select('borrower_id, nome, carteira').eq('cpf', cpf).maybeSingle();
    let cli: { borrower_id: string; nome: string | null; carteira: string | null } | null = cliSftp?.borrower_id ? cliSftp as any : null;
    let online = false;
    if (!cli) {
      // Fora do SFTP: localiza o cliente direto na consulta online da UME.
      const c = await consultarUme(db, cpf, { perfil: 'essencial', aguardarCache: false }).catch(() => null);
      if (!c?.encontrado || !c.borrowerId) return json({ success: false, message: 'Cliente não localizado na UME para este CPF.' });
      cli = { borrower_id: c.borrowerId, nome: c.nome || null, carteira: null };
      online = true;
    }

    const lerBoleto = (raw: unknown, venc: string) => {
      const d = (Array.isArray(raw) ? raw[0] : (raw as any)?.invoices?.[0] ?? (raw as any)?.data?.[0] ?? raw ?? {}) as Record<string, unknown>;
      return {
        invoiceId: String(d.id ?? ''), valor: Number(d.invoiceTotalValue ?? d.totalValue ?? 0) || null,
        vencimento: String(d.invoiceDueDate ?? d.dueDate ?? venc).slice(0, 10), pixCode: String(d.pixCode ?? ''),
        invoiceUrl: String(d.invoiceUrl ?? ''), pixQrCodeUrl: String(d.pixQrCodeUrl ?? ''), ambiente,
      };
    };
    const registrar = (b: ReturnType<typeof lerBoleto>) => db.from('ume_boleto_log').insert({ user_id: caller.userId, cpf, borrower_id: String(cli!.borrower_id), invoice_id: b.invoiceId || null, valor: b.valor, vencimento: b.vencimento, invoice_url: b.invoiceUrl || null, origem: 'atendente', ambiente });

    if (!acordo) {
      // Sem acordo nosso: usa a compra original (parcelas em aberto do SFTP) sem renegociar.
      if (online) {
        // Sem parcelas do SFTP: a UME calcula e emite a cobrança atualizada da parcela em atraso.
        const r = await umeApi.gerarBoletoUnico(ambiente, String(cli.borrower_id), escolhido ?? hoje);
        if (!r.ok) {
          const msg = String((r.data as any)?.message || (r.data as any)?.error || `ume_http_${r.status}`);
          return json({ success: false, message: traduzirErroUme(msg, 'a atualização da parcela') });
        }
        const boleto = lerBoleto(r.data, escolhido ?? hoje);
        if (!boleto.pixCode && !boleto.invoiceUrl) return json({ success: false, message: 'A UME não devolveu PIX nem boleto.' });
        await registrar(boleto);
        return json({ success: true, origem: 'compra_original', contrato: null, boleto, atrasada: true, nome: cli.nome ?? '',
          parcela: { numero: 1, total: 1, valorOriginal: null, vencimentoOriginal: null } });
      }
      let q = db.from('ume_carteira_parcelas').select('installment_id, contrato, vencimento, valor').eq('cpf', cpf);
      if (cli.carteira) q = q.eq('carteira', cli.carteira);
      const { data: parc } = await q.order('vencimento').limit(500);
      const lista = parc ?? [];
      if (!lista.length) {
        const r = await umeApi.gerarBoletoUnico(ambiente, String(cli.borrower_id), escolhido ?? hoje);
        if (!r.ok) {
          const msg = String((r.data as any)?.message || (r.data as any)?.error || `ume_http_${r.status}`);
          return json({ success: false, message: traduzirErroUme(msg, 'a atualização da parcela') });
        }
        const boleto = lerBoleto(r.data, escolhido ?? hoje);
        if (!boleto.pixCode && !boleto.invoiceUrl) return json({ success: false, message: 'A UME não devolveu PIX nem boleto.' });
        await registrar(boleto);
        return json({ success: true, origem: 'compra_original', contrato: null, boleto, atrasada: true, nome: cli.nome ?? '',
          parcela: { numero: 1, total: 1, valorOriginal: null, vencimentoOriginal: null } });
      }
      const p: any = lista[0];
      const doContrato = lista.filter((x: any) => x.contrato === p.contrato);
      const atrasada = String(p.vencimento) < hoje;
      const venc = escolhido ?? (atrasada ? hoje : String(p.vencimento));
      const r = await umeApi.gerarBoletos(ambiente, [String(p.installment_id)], venc);
      if (!r.ok) {
        const msg = String((r.data as any)?.message || (r.data as any)?.error || `ume_http_${r.status}`);
        return json({ success: false, message: traduzirErroUme(msg, 'a atualização da parcela') });
      }
      const boleto = lerBoleto(r.data, venc);
      if (!boleto.pixCode && !boleto.invoiceUrl) return json({ success: false, message: 'A UME não devolveu PIX nem boleto.' });
      await registrar(boleto);
      return json({
        success: true, origem: 'compra_original', contrato: p.contrato ?? null, boleto, atrasada, nome: cli.nome ?? '',
        parcela: { numero: 1, total: doContrato.length, valorOriginal: p.valor, vencimentoOriginal: p.vencimento },
      });
    }

    const { data: parcelas } = await rls.from('pagamentos').select('numero_parcela, valor_parcela, data_prevista, status')
      .eq('acordo_id', acordo.id).order('numero_parcela', { ascending: true });
    const lista = parcelas || [];
    const abertas = lista.filter((p: any) => p.status !== 'pago');
    if (!abertas.length) return json({ success: false, message: 'Todas as parcelas deste acordo constam como pagas.' });
    const parcela: any = abertas[0];
    const atrasada = String(parcela.data_prevista) < hoje;
    const venc = escolhido ?? (atrasada ? hoje : String(parcela.data_prevista));
    const r = await umeApi.gerarBoletoUnico(ambiente, String(cli.borrower_id), venc);
    if (!r.ok) {
      const msg = String((r.data as any)?.message || (r.data as any)?.error || `ume_http_${r.status}`);
      return json({ success: false, message: traduzirErroUme(msg, 'a atualização da parcela') });
    }
    const boleto = lerBoleto(r.data, venc);
    if (!boleto.pixCode && !boleto.invoiceUrl) return json({ success: false, message: 'A UME não devolveu PIX nem boleto.' });
    await registrar(boleto);

    return json({
      success: true, origem: 'acordo', boleto, atrasada, nome: acordo.cliente_nome,
      parcela: { numero: parcela.numero_parcela, total: lista.length, valorOriginal: parcela.valor_parcela, vencimentoOriginal: parcela.data_prevista },
    });
  } catch (e) {
    console.error('[ume-parcela-atraso]', String((e as Error)?.message || e));
    return json({ success: false, message: 'Não foi possível atualizar a parcela agora.' });
  }
});
