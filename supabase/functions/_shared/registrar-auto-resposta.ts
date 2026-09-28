import { classificarRespostaAutomatica } from './resposta-automatica.ts';

type OrigemAutoResposta = 'meta' | 'uazapi';

type RegistrarAutoRespostaArgs = {
  supabase: any;
  origem: OrigemAutoResposta;
  instanciaId: string;
  telefone: string;
  texto: string;
  mensagemChave: string;
  recebidaEm: string;
  nome?: string | null;
  logId?: string | null;
  leadId?: string | null;
  nicho?: string | null;
  cidade?: string | null;
  segundosParaResposta?: number | null;
  envioAnteriorConfirmado?: boolean;
};

const somenteDigitos = (valor: unknown) => String(valor || '').replace(/\D/g, '');

export async function registrarAutoRespostaSeConfirmada({
  supabase,
  origem,
  instanciaId,
  telefone,
  texto,
  mensagemChave,
  recebidaEm,
  nome = null,
  logId = null,
  leadId = null,
  nicho = null,
  cidade = null,
  segundosParaResposta = null,
  envioAnteriorConfirmado = false,
}: RegistrarAutoRespostaArgs): Promise<boolean> {
  const telefoneNormalizado = somenteDigitos(telefone);
  const sufixo = telefoneNormalizado.slice(-8);
  if (sufixo.length !== 8 || !texto || !mensagemChave) return false;

  // Evita consultar o histórico para toda mensagem humana. O único caso que
  // depende da rapidez é uma mensagem estruturada com sinal de atendimento.
  const classificacaoSemTempo = classificarRespostaAutomatica(texto, null);
  const estruturada = texto.length >= 100 || /\n|[•✅➡️📍📞🕐🐾]/u.test(texto);
  if (!classificacaoSemTempo.automatica && !estruturada) return false;

  let segundos = segundosParaResposta;
  if (!envioAnteriorConfirmado) {
    const tabela = origem === 'meta' ? 'meta_whatsapp_mensagens' : 'whatsapp_mensagens';
    const campoTelefone = origem === 'meta' ? 'telefone' : 'telefone_remoto';
    const recebidaMs = new Date(recebidaEm).getTime();
    if (!Number.isFinite(recebidaMs)) return false;
    const desde = new Date(recebidaMs - 30 * 86400000).toISOString();

    const { data: saidas, error } = await supabase
      .from(tabela)
      .select(`timestamp_msg, ${campoTelefone}`)
      .eq('instancia_id', instanciaId)
      .eq('direcao', 'saida')
      .like(campoTelefone, `%${sufixo}`)
      .lt('timestamp_msg', recebidaEm)
      .gte('timestamp_msg', desde)
      .order('timestamp_msg', { ascending: false })
      .limit(1);
    if (error || !saidas?.length) return false;
    const envioMs = new Date(saidas[0].timestamp_msg).getTime();
    segundos = Math.max(0, Math.round((recebidaMs - envioMs) / 1000));
  }

  const classificacao = classificarRespostaAutomatica(texto, segundos);
  if (!classificacao.automatica) return false;

  const { data, error } = await supabase.rpc('registrar_auto_resposta_geral', {
    _origem: origem,
    _mensagem_chave: mensagemChave,
    _instancia_id: instanciaId,
    _telefone_normalizado: telefoneNormalizado,
    _telefone: telefone,
    _resposta: texto,
    _motivo: classificacao.motivo,
    _confianca: classificacao.confianca,
    _detectado_em: recebidaEm,
    _nome: nome,
    _nicho: nicho,
    _cidade: cidade,
    _lead_id: leadId,
    _log_id: logId,
  });
  if (error) throw error;
  return data === true;
}