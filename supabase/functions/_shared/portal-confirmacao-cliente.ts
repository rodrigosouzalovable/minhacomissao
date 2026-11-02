// Confirmação ao cliente no WhatsApp após acordo fechado pelo portal.
// Template aprovado `confirmacao_acordo_portal`. Primeira tentativa no 3144; se a Meta
// recusar (na hora ou depois, pelo webhook), tenta outra instância saudável — até 4 tentativas.
import { aplicarEtiquetaRodrigo } from './etiqueta-portal-avista.ts';
import { ordenarCandidatasConfirmacao, MAX_TENTATIVAS_CONFIRMACAO } from './portal-confirmacao-rules.ts';
import { notificarAdmin } from './notificar-admin.ts';

export const PORTAL_CONFIRMACAO_INSTANCIA_ID = 'b103ac3e-5781-47c4-8e11-24a323f5f0ee';
export const PORTAL_CONFIRMACAO_TEMPLATE = 'confirmacao_acordo_portal';
const ADMIN_USER_ID = 'ee649720-b8ce-47a2-859e-100a3a9ae6bb';
const ODRES_EXCLUSIVO_SUFIXO = '82756510';

export interface DadosConfirmacao { nome: string; parcelas: number; valorParcela: number; vencimento: string /* YYYY-MM-DD */; credor?: string }
interface Estado { tentativa: number; excluidas: string[]; dados: DadosConfirmacao; telefone: string }

const primeiroNome = (n: string) => { const p = String(n || '').trim().split(/\s+/)[0].toLowerCase(); return p ? p[0].toUpperCase() + p.slice(1) : 'Cliente'; };
const valorBr = (v: number) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dataBr = (d: string) => String(d).slice(0, 10).split('-').reverse().join('/');
const normTel = (t: string) => { const d = String(t || '').replace(/\D/g, ''); return d.length <= 11 ? `55${d}` : d; };

async function candidatas(db: any, telefone: string, dados: DadosConfirmacao, excluidas: string[]): Promise<{ instancia: string; template: string }[]> {
  const { data: tpls } = await db.from('meta_whatsapp_templates')
    .select('id, instancia_id, meta_whatsapp_instances!inner(id, ativo, saude_quality, saude_status, display_phone)')
    .eq('nome_template', PORTAL_CONFIRMACAO_TEMPLATE).eq('status', 'approved').limit(500);
  const lista = (tpls || []).map((t: any) => ({
    instancia: t.instancia_id, template: t.id,
    ativo: !!t.meta_whatsapp_instances?.ativo,
    quality: String(t.meta_whatsapp_instances?.saude_quality || ''),
    status: String(t.meta_whatsapp_instances?.saude_status || ''),
    sufixo: String(t.meta_whatsapp_instances?.display_phone || '').replace(/\D/g, '').slice(-8),
  }));
  const { data: ult } = await db.from('meta_whatsapp_mensagens').select('instancia_id')
    .eq('telefone', telefone).eq('direcao', 'saida').eq('status_envio', 'enviada')
    .order('criado_em', { ascending: false }).limit(5);
  return ordenarCandidatasConfirmacao(lista, {
    principal: PORTAL_CONFIRMACAO_INSTANCIA_ID,
    recentes: (ult || []).map((u: any) => u.instancia_id),
    exclusivaSufixo: /odres/i.test(String(dados.credor || '')) ? ODRES_EXCLUSIVO_SUFIXO : null,
    excluidas,
  });
}

async function enviarUma(db: any, c: { instancia: string; template: string }, estado: Estado): Promise<{ ok: boolean; motivo: string }> {
  const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-whatsapp-meta`;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const { dados, telefone } = estado;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_id: c.template, instancia_id: c.instancia, user_id: ADMIN_USER_ID,
        cliente: { nome: dados.nome, telefone, vars: { '1': primeiroNome(dados.nome), '2': String(dados.parcelas), '3': valorBr(dados.valorParcela), '4': dataBr(dados.vencimento) } },
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!(r.ok && j?.success !== false)) return { ok: false, motivo: String(j?.error || `HTTP ${r.status}`).slice(0, 160) };
    // Marca a mensagem criada com o estado para o webhook poder refazer em caso de falha.
    const { data: msg } = await db.from('meta_whatsapp_mensagens').select('id, payload_diagnostico')
      .eq('telefone', telefone).eq('instancia_id', c.instancia).eq('template_nome', PORTAL_CONFIRMACAO_TEMPLATE)
      .order('criado_em', { ascending: false }).limit(1).maybeSingle();
    if (msg?.id) {
      await db.from('meta_whatsapp_mensagens').update({ payload_diagnostico: { ...(msg.payload_diagnostico || {}), portal_confirmacao: estado } }).eq('id', msg.id);
    }
    if (Number(dados.parcelas) === 1) {
      try {
        const { data: ct } = await db.from('meta_whatsapp_contatos').select('id')
          .eq('instancia_id', c.instancia).like('telefone', `%${telefone.slice(-8)}`).limit(1).maybeSingle();
        if (ct?.id) await aplicarEtiquetaRodrigo(db, ct.id);
      } catch (e) { console.log('[portal-confirmacao] etiqueta', String(e)); }
    }
    return { ok: true, motivo: 'enviado' };
  } catch (e) { return { ok: false, motivo: String(e).slice(0, 160) }; }
}

/** Tenta enviar a partir do estado; pula instâncias que recusarem na hora. */
async function tentar(db: any, estado: Estado): Promise<{ ok: boolean; motivo: string }> {
  let motivo = 'nenhuma instância disponível com o template aprovado';
  while (estado.tentativa < MAX_TENTATIVAS_CONFIRMACAO) {
    const [c] = await candidatas(db, estado.telefone, estado.dados, estado.excluidas);
    if (!c) break;
    estado = { ...estado, tentativa: estado.tentativa + 1, excluidas: [...estado.excluidas, c.instancia] };
    const r = await enviarUma(db, c, estado);
    if (r.ok) return r;
    motivo = r.motivo;
    console.log('[portal-confirmacao] falhou na instância', c.instancia, r.motivo);
  }
  return { ok: false, motivo };
}

export async function enviarConfirmacaoPortal(db: any, telefone: string, dados: DadosConfirmacao): Promise<{ ok: boolean; motivo: string }> {
  const digits = String(telefone || '').replace(/\D/g, '');
  if (digits.length < 10) return { ok: false, motivo: 'telefone inválido' };
  return tentar(db, { tentativa: 0, excluidas: [], dados, telefone: normTel(digits) });
}

/** Chamado pelo webhook quando a Meta informa falha de entrega de uma confirmação. */
export async function reenviarConfirmacaoAposFalha(db: any, waMessageId: string, erro: string): Promise<void> {
  const { data: msg } = await db.from('meta_whatsapp_mensagens').select('id, payload_diagnostico, template_nome')
    .eq('wa_message_id', waMessageId).maybeSingle();
  const estado: Estado | undefined = msg?.payload_diagnostico?.portal_confirmacao;
  if (!msg || msg.template_nome !== PORTAL_CONFIRMACAO_TEMPLATE || !estado || (msg.payload_diagnostico as any)?.portal_reenvio_feito) return;
  await db.from('meta_whatsapp_mensagens').update({ payload_diagnostico: { ...msg.payload_diagnostico, portal_reenvio_feito: true } }).eq('id', msg.id);
  const r = await tentar(db, estado);
  console.log('[portal-confirmacao] reenvio após falha', waMessageId, r);
  if (!r.ok) {
    await notificarAdmin(db, {
      tipo: 'portal_confirmacao_falhou',
      chaveIdempotencia: `portal-conf-falha:${estado.telefone}:${estado.dados.vencimento}`,
      umaVezPorChave: true,
      mensagem: `⚠️ *Confirmação NÃO entregue* ao cliente ${estado.dados.nome} (${estado.telefone}).\nMotivo Meta: ${erro}. Tentativas: ${estado.tentativa}. Enviar manualmente.`,
    }).catch((e: unknown) => console.error('[portal-confirmacao] aviso', String(e)));
  }
}
