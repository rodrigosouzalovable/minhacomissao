// Confirmação ao cliente no WhatsApp após acordo fechado pelo portal.
// Sempre pelo template aprovado `confirmacao_acordo_portal`, somente na instância Novo Mundo 3144.
import { aplicarEtiquetaRodrigo } from './etiqueta-portal-avista.ts';

export const PORTAL_CONFIRMACAO_INSTANCIA_ID = 'b103ac3e-5781-47c4-8e11-24a323f5f0ee';
export const PORTAL_CONFIRMACAO_TEMPLATE = 'confirmacao_acordo_portal';
const ADMIN_USER_ID = 'ee649720-b8ce-47a2-859e-100a3a9ae6bb';

export interface DadosConfirmacao { nome: string; parcelas: number; valorParcela: number; vencimento: string /* YYYY-MM-DD */ }

const primeiroNome = (n: string) => { const p = String(n || '').trim().split(/\s+/)[0].toLowerCase(); return p ? p[0].toUpperCase() + p.slice(1) : 'Cliente'; };
const valorBr = (v: number) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dataBr = (d: string) => String(d).slice(0, 10).split('-').reverse().join('/');

export async function enviarConfirmacaoPortal(db: any, telefone: string, dados: DadosConfirmacao): Promise<{ ok: boolean; motivo: string }> {
  const digits = String(telefone || '').replace(/\D/g, '');
  if (digits.length < 10) return { ok: false, motivo: 'telefone inválido' };
  const { data: tpl } = await db.from('meta_whatsapp_templates').select('id')
    .eq('instancia_id', PORTAL_CONFIRMACAO_INSTANCIA_ID).eq('nome_template', PORTAL_CONFIRMACAO_TEMPLATE).eq('status', 'approved').maybeSingle();
  if (!tpl?.id) return { ok: false, motivo: 'template confirmacao_acordo_portal não aprovado na Novo Mundo 3144' };

  const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-whatsapp-meta`;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_id: tpl.id, instancia_id: PORTAL_CONFIRMACAO_INSTANCIA_ID, user_id: ADMIN_USER_ID,
        cliente: {
          nome: dados.nome, telefone: digits.length <= 11 ? `55${digits}` : digits,
          vars: { '1': primeiroNome(dados.nome), '2': String(dados.parcelas), '3': valorBr(dados.valorParcela), '4': dataBr(dados.vencimento) },
        },
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j?.success !== false) {
      if (Number(dados.parcelas) === 1) {
        try {
          const { data: ct } = await db.from('meta_whatsapp_contatos').select('id')
            .eq('instancia_id', PORTAL_CONFIRMACAO_INSTANCIA_ID).like('telefone', `%${digits.slice(-8)}`).limit(1).maybeSingle();
          if (ct?.id) await aplicarEtiquetaRodrigo(db, ct.id);
        } catch (e) { console.log('[portal-confirmacao] etiqueta', String(e)); }
      }
      return { ok: true, motivo: 'enviado' };
    }
    return { ok: false, motivo: String(j?.error || `HTTP ${r.status}`).slice(0, 160) };
  } catch (e) { return { ok: false, motivo: String(e).slice(0, 160) }; }
}
