import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import { obterTokenUme, umeApi, type UmeAmbiente } from '../_shared/ume-api.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const reneg = z.object({
  borrowerId: z.string().min(1).max(100),
  installmentsIds: z.array(z.number().int()).max(200),
  monetaryDiscount: z.number().min(0),
  firstPaymentDueDate: data,
  numberOfPayments: z.number().int().min(1).max(60),
  interestRate: z.number().min(0),
});
const Body = z.discriminatedUnion('acao', [
  z.object({ acao: z.literal('testar_conexao') }),
  z.object({ acao: z.literal('simular_boletos'), idsOrdem: z.array(z.union([z.string(), z.number()])).min(1).max(50), data }),
  z.object({ acao: z.literal('gerar_boletos'), installmentsIds: z.array(z.number().int()).min(1).max(200), dueDate: data }),
  z.object({ acao: z.literal('gerar_boleto_unico'), borrowerId: z.string().min(1).max(100), dueDate: data }),
  z.object({ acao: z.literal('simular_renegociacao'), ...reneg.shape }),
  z.object({ acao: z.literal('fechar_acordo'), confirmar: z.literal(true), ...reneg.shape }),
]);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'não autenticado' }, 401);
    const { data: u } = await service.auth.getUser(jwt);
    if (!u?.user) return json({ error: 'não autenticado' }, 401);
    const { data: isAdmin } = await service.rpc('has_role', { _user_id: u.user.id, _role: 'admin' });
    if (isAdmin !== true) return json({ error: 'apenas administradores' }, 403);

    const raw = await req.json().catch(() => ({}));
    // Fase de homologação: somente DEV. Produção só quando liberada explicitamente.
    const ambiente: UmeAmbiente = raw?.ambiente === 'prd' && Deno.env.get('UME_PRD_LIBERADO') === 'true' ? 'prd' : 'dev';
    const parsed = Body.safeParse(raw);
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
    const b = parsed.data;

    const t0 = Date.now();
    let r: unknown;
    switch (b.acao) {
      case 'testar_conexao': await obterTokenUme(ambiente, true); r = { status: 200, ok: true, data: { autenticado: true } }; break;
      case 'simular_boletos': r = await umeApi.simularBoletos(ambiente, b.idsOrdem, b.data); break;
      case 'gerar_boletos': r = await umeApi.gerarBoletos(ambiente, b.installmentsIds, b.dueDate); break;
      case 'gerar_boleto_unico': r = await umeApi.gerarBoletoUnico(ambiente, b.borrowerId, b.dueDate); break;
      case 'simular_renegociacao': { const { acao: _a, ...p } = b; r = await umeApi.simularRenegociacao(ambiente, p); break; }
      case 'fechar_acordo': { const { acao: _a, confirmar: _c, ...p } = b; r = await umeApi.fecharAcordo(ambiente, p); break; }
    }
    console.log('[ume-api-action]', { acao: b.acao, ambiente, ms: Date.now() - t0, status: (r as any)?.status });
    return json({ success: (r as any)?.ok === true, ambiente, ...(r as object) });
  } catch (e) {
    const msg = String((e as Error)?.message || e);
    console.error('[ume-api-action] erro', msg);
    return json({ success: false, error: msg }, 200);
  }
});
