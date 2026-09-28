import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { registrarAutoRespostaSeConfirmada } from '../_shared/registrar-auto-resposta.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const auth = req.headers.get('Authorization') || '';
  if (!serviceKey) return json({ error: 'Configuração indisponível' }, 500);
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabase = createClient(supabaseUrl, serviceKey);
  if (auth !== `Bearer ${serviceKey}`) {
    const jwt = auth.replace(/^Bearer\s+/i, '');
    const { data: authData } = await supabase.auth.getUser(jwt);
    const userId = authData.user?.id;
    if (!userId) return json({ error: 'Não autorizado' }, 401);
    const { data: admin } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' });
    if (admin !== true) return json({ error: 'Acesso restrito ao administrador' }, 403);
  }
  try {
    const body = await req.json().catch(() => ({}));
    const origem = body?.origem === 'uazapi' ? 'uazapi' : 'meta';
    const offset = Math.max(0, Number(body?.offset || 0));
    const limit = Math.min(500, Math.max(1, Number(body?.limit || 500)));
    const desde = new Date(Date.now() - 7 * 86400000).toISOString();
    const tabela = origem === 'meta' ? 'meta_whatsapp_mensagens' : 'whatsapp_mensagens';
    const campoTelefone = origem === 'meta' ? 'telefone' : 'telefone_remoto';
    const campoNome = origem === 'meta' ? null : 'nome_contato';
    const campoChave = origem === 'meta' ? 'wa_message_id' : 'whatsapp_msg_id';
    const campos = ['id', 'instancia_id', campoTelefone, 'conteudo', 'timestamp_msg', campoChave];

    const { data: mensagens, error } = await supabase
      .from(tabela)
      .select(campos.join(','))
      .eq('direcao', 'entrada')
      .gte('timestamp_msg', desde)
      .order('timestamp_msg', { ascending: true })
      .range(offset, offset + limit - 1);
    if (error) throw error;

    let registradas = 0;
    let erros = 0;
    for (const mensagem of mensagens || []) {
      try {
        const telefone = String(mensagem[campoTelefone] || '');
        const chave = String(mensagem[campoChave] || mensagem.id || '');
        const registrada = await registrarAutoRespostaSeConfirmada({
          supabase,
          origem,
          instanciaId: String(mensagem.instancia_id || ''),
          telefone,
          texto: String(mensagem.conteudo || ''),
          mensagemChave: chave,
          recebidaEm: String(mensagem.timestamp_msg),
          nome: campoNome ? mensagem[campoNome] : null,
        });
        if (registrada) registradas++;
      } catch (erro) {
        erros++;
        console.error('[backfill-auto-respostas] mensagem falhou', mensagem.id, erro);
      }
    }

    return json({ ok: true, origem, offset, processadas: mensagens?.length || 0, registradas, erros, proximo_offset: offset + (mensagens?.length || 0) });
  } catch (erro) {
    console.error('[backfill-auto-respostas]', erro);
    return json({ error: erro instanceof Error ? erro.message : 'Falha na revisão' }, 500);
  }
});