import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import { umeApi, type UmeAmbiente } from '../_shared/ume-api.ts';
import { consultarUme, soDigitos } from '../_shared/ume-desconto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const Body = z.object({
  acao: z.literal('gerar'),
  cpf: z.string().min(11).max(14),
  vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  origem: z.enum(['atendente', 'iago']).default('atendente'),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'não autenticado' }, 401);
    const { data: u } = await service.auth.getUser(jwt);
    if (!u?.user) return json({ error: 'não autenticado' }, 401);

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
    const { cpf: cpfBruto, vencimento, origem } = parsed.data;
    const cpf = soDigitos(cpfBruto);
    if (cpf.length !== 11) return json({ error: 'CPF inválido' }, 400);

    // Vencimento não pode ser no passado
    const hoje = new Date().toISOString().slice(0, 10);
    if (vencimento < hoje) return json({ error: 'vencimento não pode ser no passado' }, 400);

    // borrowerId vem da consulta da calculadora (cache de 12h; consulta se não houver)
    const consulta = await consultarUme(service, cpf, { perfil: 'essencial', aguardarCache: false });
    if (!consulta.encontrado || !consulta.borrowerId) {
      return json({ success: false, error: 'cpf_nao_encontrado', message: 'CPF não localizado na base da UME.' });
    }

    // Fase de homologação: somente DEV. Produção só quando liberada explicitamente.
    const ambiente: UmeAmbiente = Deno.env.get('UME_PRD_LIBERADO') === 'true' ? 'prd' : 'dev';

    const t0 = Date.now();
    const r = await umeApi.gerarBoletoUnico(ambiente, consulta.borrowerId, vencimento);
    console.log('[ume-boleto]', { ambiente, ms: Date.now() - t0, status: r.status });

    if (!r.ok) {
      const msg = String((r.data as any)?.message || (r.data as any)?.error || `ume_http_${r.status}`);
      return json({ success: false, error: msg, message: 'A UME recusou a geração do boleto. Tente novamente ou confira o cadastro.' });
    }

    const d = r.data as Record<string, unknown>;
    const boleto = {
      invoiceId: String(d.id ?? ''),
      valor: Number(d.invoiceTotalValue ?? 0) || null,
      vencimento: String(d.invoiceDueDate ?? vencimento),
      pixCode: String(d.pixCode ?? ''),
      invoiceUrl: String(d.invoiceUrl ?? ''),
      pixQrCodeUrl: String(d.pixQrCodeUrl ?? ''),
      barcode: String(d.barcode ?? ''),
      ambiente,
    };

    await service.from('ume_boleto_log').insert({
      user_id: u.user.id,
      cpf,
      borrower_id: consulta.borrowerId,
      invoice_id: boleto.invoiceId || null,
      valor: boleto.valor,
      vencimento: boleto.vencimento,
      invoice_url: boleto.invoiceUrl || null,
      origem,
      ambiente,
    });

    return json({ success: true, boleto, nomeCliente: consulta.nome });
  } catch (e) {
    const msg = String((e as Error)?.message || e);
    console.error('[ume-boleto] erro', msg);
    return json({ success: false, error: msg }, 200);
  }
});
