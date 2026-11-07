// Público: 2ª via do PIX/boleto de uma parcela pendente (ou em atraso) de acordo ativo
// UME / Odres Cred. A parcela precisa pertencer a um acordo ativo do CPF informado.
// A UME emite a fatura do próximo débito em aberto do cliente; vencida → data de hoje.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3.23.8';
import { umeApi, type UmeAmbiente } from '../_shared/ume-api.ts';

const ADMIN_USER_ID = 'ee649720-b8ce-47a2-859e-100a3a9ae6bb';
const json = (b: unknown) => new Response(JSON.stringify(b), { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const NAO = 'Não conseguimos gerar o PIX agora. Fale com nossa equipe no WhatsApp para receber a 2ª via.';

const Body = z.object({
  cpf: z.string().transform((v) => v.replace(/\D/g, '')).refine((v) => v.length === 11),
  credor: z.enum(['ume', 'odres_cred']),
  acordoId: z.string().uuid(),
  numeroParcela: z.number().int().min(1).max(60),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ success: false, message: 'Dados inválidos.' });
    const b = parsed.data;
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const db = createClient(Deno.env.get('SUPABASE_URL')!, key, { auth: { persistSession: false } });

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const dig = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${key}:portal-pix:${ip}:${b.cpf}`));
    const chave = Array.from(new Uint8Array(dig), (v) => v.toString(16).padStart(2, '0')).join('');
    const { data: ok } = await db.rpc('portal_reservar_consulta', { p_chave: chave });
    if (ok !== true) return json({ success: false, message: 'Muitas tentativas em pouco tempo. Aguarde alguns minutos.' });

    const { data: acordo } = await db.from('acordos').select('id').eq('id', b.acordoId).eq('cliente_cpf', b.cpf).eq('status', 'ativo').maybeSingle();
    if (!acordo) return json({ success: false, message: NAO });
    const { data: parcela } = await db.from('pagamentos').select('valor_parcela, data_prevista, status').eq('acordo_id', acordo.id).eq('numero_parcela', b.numeroParcela).maybeSingle();
    if (!parcela || parcela.status === 'pago') return json({ success: false, message: 'Esta parcela já consta como paga.' });

    const { data: cli } = await db.from('ume_carteira_clientes').select('borrower_id').eq('cpf', b.cpf).maybeSingle();
    if (!cli?.borrower_id) return json({ success: false, message: NAO });

    const hoje = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
    const venc = String(parcela.data_prevista) < hoje ? hoje : String(parcela.data_prevista);
    const ambiente: UmeAmbiente = Deno.env.get('UME_PRD_LIBERADO') === 'true' ? 'prd' : 'dev';
    const r = await umeApi.gerarBoletoUnico(ambiente, String(cli.borrower_id), venc);
    if (!r.ok) { console.log('[portal-pix] UME recusou', r.status); return json({ success: false, message: NAO }); }
    const d = (r.data ?? {}) as Record<string, unknown>;
    const boleto = { valor: Number(d.invoiceTotalValue ?? 0) || null, vencimento: String(d.invoiceDueDate ?? venc).slice(0, 10), pixCode: String(d.pixCode ?? ''), invoiceUrl: String(d.invoiceUrl ?? ''), pixQrCodeUrl: String(d.pixQrCodeUrl ?? ''), barcode: String(d.barcode ?? '') };
    if (!boleto.pixCode && !boleto.barcode) return json({ success: false, message: NAO });
    await db.from('ume_boleto_log').insert({ user_id: ADMIN_USER_ID, cpf: b.cpf, borrower_id: String(cli.borrower_id), invoice_id: String(d.id ?? '') || null, valor: boleto.valor, vencimento: boleto.vencimento, invoice_url: boleto.invoiceUrl || null, origem: 'atendente', ambiente });
    return json({ success: true, atrasada: String(parcela.data_prevista) < hoje, boleto });
  } catch (e) {
    console.error('[portal-pix] erro', String((e as Error)?.message || e));
    return json({ success: false, message: NAO });
  }
});
