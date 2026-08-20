// Envia o pedido de permissão de chamada para o cliente.
// Dentro da janela de 24h usa a mensagem interativa "call_permission_request";
// fora da janela usa o template UTILITY com botão de permissão (nome em template).
import {
  corsHeaders, json, service, userDaRequisicao, carregarInstancia, podeUsarInstancia,
  humanizarErroChamada, digitos, GRAPH,
} from '../_shared/meta-call.ts';

const TEXTO_PADRAO = 'Podemos falar por chamada de voz agora para agilizar sua negociação? Toque em "Aceitar chamada" para autorizar.';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const instanciaId: string = body?.instancia_id;
    const telefone = digitos(body?.telefone);
    const contatoId: string | null = body?.contato_id ?? null;
    const texto: string = String(body?.texto || TEXTO_PADRAO).slice(0, 1024);
    const template: string | null = body?.template ?? null;
    const templateIdioma: string = body?.template_idioma || 'pt_BR';
    const nomeCliente: string = String(body?.nome || 'cliente').slice(0, 60);

    if (!instanciaId || !telefone) return json({ ok: false, error: 'instancia_id e telefone são obrigatórios' }, 400);

    const supabase = service();
    const userId = await userDaRequisicao(req);
    if (!(await podeUsarInstancia(supabase, userId, instanciaId))) {
      return json({ ok: false, error: 'Sem acesso a esta instância' }, 403);
    }
    const inst = await carregarInstancia(supabase, instanciaId);

    const payload = template
      ? {
        messaging_product: 'whatsapp', recipient_type: 'individual', to: telefone, type: 'template',
        template: {
          name: template,
          language: { code: templateIdioma },
          components: [{ type: 'body', parameters: [{ type: 'text', text: nomeCliente }] }],
        },
      }
      : null;

    const payloadInterativo = (nomeCta: string) => ({
      messaging_product: 'whatsapp', recipient_type: 'individual', to: telefone, type: 'interactive',
      interactive: {
        type: 'call_permission_request',
        body: { text: texto },
        action: { name: nomeCta },
      },
    });

    const enviar = async (corpo: unknown) => {
      const res = await fetch(`${GRAPH}/${inst.phone_number_id}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${inst.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok && !data?.error, status: res.status, data };
    };

    let r = await enviar(payload ?? payloadInterativo('call_permission_request'));

    // 131009 no CTA: tenta o nome antigo antes de desistir.
    if (!payload && !r.ok && Number(r.data?.error?.code ?? 0) === 131009) {
      console.error('[meta-call-permission-request] CTA recusado', JSON.stringify(r.data));
      r = await enviar(payloadInterativo('review_call_permission'));
    }

    const data = r.data;

    if (!r.ok) {
      const erro = humanizarErroChamada(data);
      console.error('[meta-call-permission-request] falha', r.status, JSON.stringify(data));
      return json({ ok: false, error: erro, status: r.status, details: data }, 200);
    }


    await supabase.from('meta_call_permissions').upsert({
      contato_id: contatoId, instancia_id: inst.id, telefone,
      status: 'pending', solicitado_em: new Date().toISOString(), atualizado_em: new Date().toISOString(),
    }, { onConflict: 'instancia_id,telefone' });

    return json({ ok: true, wa_message_id: data?.messages?.[0]?.id ?? null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('[meta-call-permission-request] erro', msg);
    return json({ ok: false, error: msg }, 200);
  }
});
