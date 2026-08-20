import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { ChamadaFlutuante } from '@/components/inbox/meta/ChamadaFlutuante';
import { ChamadaEntrandoDialog } from '@/components/inbox/meta/ChamadaEntrandoDialog';

export type ChamadaRow = {
  id: string;
  call_id: string | null;
  contato_id: string | null;
  instancia_id: string | null;
  telefone: string;
  tipo_chamada: string;
  status: string;
  duracao_segundos: number;
  data_inicio: string;
  data_fim: string | null;
  custo_estimado: number | null;
  erro: string | null;
  sdp_offer: string | null;
  sdp_answer: string | null;
  funcionario_id?: string | null;
};

export type EstadoChamada = 'idle' | 'preparando' | 'chamando' | 'em_andamento' | 'encerrando';

type Alvo = { contato_id?: string | null; instancia_id: string; telefone: string; nome?: string | null };

type Ctx = {
  estado: EstadoChamada;
  alvo: Alvo | null;
  segundos: number;
  mudo: boolean;
  ligar: (alvo: Alvo) => Promise<void>;
  pedirPermissao: (alvo: Alvo) => Promise<boolean>;
  /** Revalida no banco e liga se já autorizado; caso contrário pede a permissão. */
  ligarOuPedirPermissao: (alvo: Alvo) => Promise<void>;
  encerrar: () => Promise<void>;
  alternarMudo: () => void;
  permissaoDe: (instanciaId: string, telefone: string) => 'accepted' | 'pending' | 'rejected' | 'none';
  recarregarPermissoes: () => Promise<void>;
  revalidarPermissao: (instanciaId: string, telefone: string) => Promise<'accepted' | 'pending' | 'rejected' | 'none'>;

  /** true quando o número oficial já tem chamadas de voz ligadas. */
  chamadasHabilitadas: (instanciaId: string) => boolean;
  recarregarInstanciasComChamada: () => Promise<void>;
};


const MetaCallContext = createContext<Ctx | null>(null);

const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
const dig = (v?: string | null) => String(v ?? '').replace(/\D/g, '');

export function MetaCallProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [estado, setEstado] = useState<EstadoChamada>('idle');
  const [alvo, setAlvo] = useState<Alvo | null>(null);
  const [segundos, setSegundos] = useState(0);
  const [mudo, setMudo] = useState(false);
  const [entrando, setEntrando] = useState<ChamadaRow | null>(null);
  const [permissoes, setPermissoes] = useState<Record<string, { status: string; expira_em: string | null }>>({});
  const [comChamada, setComChamada] = useState<Set<string>>(new Set());
  const meuIdRef = useRef<string | null>(null);
  const souAdminRef = useRef(false);

  useEffect(() => {
    void supabase.auth.getUser().then(async ({ data }) => {
      const uid = data?.user?.id ?? null;
      meuIdRef.current = uid;
      if (!uid) return;
      const { data: adm } = await supabase.rpc('has_role', { _user_id: uid, _role: 'admin' });
      souAdminRef.current = adm === true;
    });
  }, []);




  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const callIdRef = useRef<string | null>(null);
  const chamadaIdRef = useRef<string | null>(null);
  const answerAplicadaRef = useRef(false);
  const direcaoRef = useRef<'saida' | 'entrada' | null>(null);


  // ---------- permissões ----------
  const recarregarPermissoes = useCallback(async () => {
    const { data } = await supabase.from('meta_call_permissions')
      .select('instancia_id, telefone, status, expira_em');
    const map: Record<string, { status: string; expira_em: string | null }> = {};
    for (const p of data ?? []) map[`${p.instancia_id}:${dig(p.telefone)}`] = { status: p.status, expira_em: p.expira_em };
    setPermissoes(map);
  }, []);

  useEffect(() => { void recarregarPermissoes(); }, [recarregarPermissoes]);

  // ---------- quais números têm chamadas de voz ligadas ----------
  const recarregarInstanciasComChamada = useCallback(async () => {
    const { data } = await supabase.from('meta_whatsapp_instances')
      .select('id').eq('chamadas_habilitadas', true);
    setComChamada(new Set((data ?? []).map((r: any) => r.id)));
  }, []);

  useEffect(() => { void recarregarInstanciasComChamada(); }, [recarregarInstanciasComChamada]);

  const chamadasHabilitadas = useCallback((instanciaId: string) => comChamada.has(instanciaId), [comChamada]);



  const permissaoDe = useCallback((instanciaId: string, telefone: string) => {
    const p = permissoes[`${instanciaId}:${dig(telefone)}`];
    if (!p) return 'none' as const;
    if (p.status === 'accepted' && p.expira_em && new Date(p.expira_em).getTime() < Date.now()) return 'none' as const;
    return (p.status as 'accepted' | 'pending' | 'rejected') ?? 'none';
  }, [permissoes]);

  // ---------- cronômetro ----------
  useEffect(() => {
    if (estado !== 'em_andamento') return;
    const t = setInterval(() => setSegundos(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [estado]);

  const limpar = useCallback(() => {
    try { pcRef.current?.getSenders().forEach(s => s.track?.stop()); } catch { /* noop */ }
    try { pcRef.current?.close(); } catch { /* noop */ }
    pcRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (audioRef.current) { audioRef.current.srcObject = null; audioRef.current = null; }
    callIdRef.current = null;
    chamadaIdRef.current = null;
    answerAplicadaRef.current = false;
    direcaoRef.current = null;

    setSegundos(0);
    setMudo(false);
    setEstado('idle');
    setAlvo(null);
  }, []);

  const criarPc = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    streamRef.current = stream;
    const pc = new RTCPeerConnection({ iceServers: ICE });
    stream.getTracks().forEach(t => pc.addTrack(t, stream));
    pc.ontrack = (ev) => {
      const el = audioRef.current ?? new Audio();
      el.autoplay = true;
      el.srcObject = ev.streams[0];
      void el.play().catch(() => undefined);
      audioRef.current = el;
    };
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
        setEstado(prev => (prev === 'em_andamento' ? 'encerrando' : prev));
      }
    };
    pcRef.current = pc;
    return pc;
  }, []);

  /** Espera o ICE terminar para mandar um SDP completo à Meta. */
  const sdpCompleto = (pc: RTCPeerConnection) => new Promise<string>((resolve) => {
    if (pc.iceGatheringState === 'complete') return resolve(pc.localDescription?.sdp ?? '');
    const done = () => {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', done);
        resolve(pc.localDescription?.sdp ?? '');
      }
    };
    pc.addEventListener('icegatheringstatechange', done);
    setTimeout(() => resolve(pc.localDescription?.sdp ?? ''), 3000);
  });

  // ---------- tradução de erros da função de chamadas ----------
  const detalheTexto = (d: any) => {
    if (!d) return '';
    if (typeof d === 'string') return d;
    const alvo = d?.error?.error_data?.details ?? d?.error?.message;
    if (typeof alvo === 'string') return alvo;
    try { return JSON.stringify(d).slice(0, 300); } catch { return ''; }
  };
  const erroLegivel = async (error: any, data: any): Promise<string> => {
    if (data?.error) {
      const det = detalheTexto(data.details);
      return String(det ? `${data.error} — ${det}` : data.error);
    }

    const bruto = String(error?.message ?? '');
    // erro de rede/deploy: o navegador não conseguiu falar com o backend
    if (/Failed to send a request|Failed to fetch|NetworkError|FunctionsFetchError/i.test(bruto)) {
      return 'O recurso de chamadas não respondeu no servidor. Tente novamente em alguns segundos; se continuar, o serviço de chamadas está indisponível.';
    }
    // resposta HTTP de erro: tenta ler o corpo para mostrar o motivo real
    try {
      const ctx = error?.context;
      if (ctx && typeof ctx.text === 'function') {
        const txt = await ctx.text();
        try {
          const j = JSON.parse(txt);
          if (j?.error) return String(detalheTexto(j.details) ? `${j.error} — ${detalheTexto(j.details)}` : j.error);
        } catch { /* corpo não-JSON */ }
        if (txt) return txt.slice(0, 300);
      }
    } catch { /* ignora */ }
    return bruto || 'Erro desconhecido';
  };

  /** Reconsulta no banco a permissão daquele par (instância + telefone) e atualiza o mapa local. */
  const revalidarPermissao = useCallback(async (instanciaId: string, telefone: string) => {
    const tel = dig(telefone);
    const suf = tel.slice(-8);
    const { data } = await supabase.from('meta_call_permissions')
      .select('telefone, status, expira_em')
      .eq('instancia_id', instanciaId)
      .like('telefone', `%${suf}`);
    const row = (data ?? [])[0];
    if (!row) return 'none' as const;
    setPermissoes(prev => ({
      ...prev,
      [`${instanciaId}:${tel}`]: { status: row.status, expira_em: row.expira_em },
      [`${instanciaId}:${dig(row.telefone)}`]: { status: row.status, expira_em: row.expira_em },
    }));
    if (row.status === 'accepted' && row.expira_em && new Date(row.expira_em).getTime() < Date.now()) return 'none' as const;
    return (row.status as 'accepted' | 'pending' | 'rejected') ?? 'none';
  }, []);

  // ---------- pedido de permissão ----------
  const pedirPermissao = useCallback(async (a: Alvo) => {
    if (!comChamada.has(a.instancia_id)) {
      toast({
        title: 'Chamadas de voz desligadas neste número',
        description: 'Ative em API Oficial Meta → card da instância → botão "Chamadas". O número também precisa ter Chamadas (Calling) habilitado no painel da Meta.',
        variant: 'destructive',
      });
      return false;
    }

    // o cliente pode já ter aceitado (webhook) — evita reenviar convite e estourar o limite da Meta
    if (await revalidarPermissao(a.instancia_id, a.telefone) === 'accepted') {
      toast({ title: 'Cliente já autorizou as chamadas', description: 'Clique novamente no telefone para ligar.' });
      return true;
    }

    const { data, error } = await supabase.functions.invoke('meta-call-permission-request', {
      body: {
        instancia_id: a.instancia_id, telefone: dig(a.telefone),
        contato_id: a.contato_id ?? null, nome: (a.nome || '').split(' ')[0] || 'cliente',
      },
    });
    if (error || !data?.ok) {
      const msg = await erroLegivel(error, data);
      // Meta recusa novo convite quando já existe um ativo/aceito
      if (/limit .*call permission|call permission requests has exceeded|138010/i.test(msg)) {
        const st = await revalidarPermissao(a.instancia_id, a.telefone);
        toast({
          title: st === 'accepted' ? 'Cliente já autorizou as chamadas' : 'Convite de chamada já enviado',
          description: st === 'accepted'
            ? 'Clique novamente no telefone para ligar.'
            : 'A Meta não permite reenviar o pedido agora. Aguarde o cliente tocar em "Permitir" no WhatsApp.',
        });
        return st === 'accepted';
      }
      toast({ title: 'Não foi possível pedir a permissão', description: msg, variant: 'destructive' });
      return false;
    }
    toast({
      title: 'Pedido de chamada enviado',
      description: 'Quando o cliente tocar em "Aceitar chamada", o botão de ligar fica liberado.',
    });
    await recarregarPermissoes();
    return true;
  }, [toast, recarregarPermissoes, comChamada, revalidarPermissao]);



  // ---------- chamada de saída ----------
  const ligar = useCallback(async (a: Alvo) => {
    if (estado !== 'idle') {
      toast({ title: 'Já existe uma chamada em andamento', variant: 'destructive' });
      return;
    }
    if (!comChamada.has(a.instancia_id)) {
      toast({
        title: 'Chamadas de voz desligadas neste número',
        description: 'Ative em API Oficial Meta → card da instância → botão "Chamadas". O número também precisa ter Chamadas (Calling) habilitado no painel da Meta.',
        variant: 'destructive',
      });
      return;
    }
    setAlvo(a);
    setEstado('preparando');
    direcaoRef.current = 'saida';
    try {

      const pc = await criarPc();
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      const sdp = await sdpCompleto(pc);

      const { data, error } = await supabase.functions.invoke('meta-call-start', {
        body: { instancia_id: a.instancia_id, telefone: dig(a.telefone), contato_id: a.contato_id ?? null, sdp },
      });
      if (error) throw new Error(await erroLegivel(error, data));
      if (!data?.ok) {
        if (data?.precisa_permissao) {
          limpar();
          await pedirPermissao(a);
          return;
        }
        throw new Error(await erroLegivel(null, data));
      }
      callIdRef.current = data.call_id;
      chamadaIdRef.current = data.chamada_id ?? null;
      setEstado('chamando');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao ligar';
      limpar();
      toast({ title: 'Chamada não iniciada', description: msg, variant: 'destructive' });

    }
  }, [estado, criarPc, toast, limpar, pedirPermissao, comChamada]);

  /** Botão de telefone: revalida a permissão e decide entre ligar ou pedir autorização. */
  const ligarOuPedirPermissao = useCallback(async (a: Alvo) => {
    const st = await revalidarPermissao(a.instancia_id, a.telefone);
    if (st === 'accepted') { await ligar(a); return; }
    await pedirPermissao(a);
  }, [revalidarPermissao, ligar, pedirPermissao]);




  const encerrar = useCallback(async () => {
    const callId = callIdRef.current;
    setEstado('encerrando');
    if (callId) {
      await supabase.functions.invoke('meta-call-action', {
        body: { acao: 'terminate', call_id: callId, instancia_id: alvo?.instancia_id },
      }).catch(() => undefined);
    }
    limpar();
  }, [alvo?.instancia_id, limpar]);

  const alternarMudo = useCallback(() => {
    const tracks = streamRef.current?.getAudioTracks() ?? [];
    const novo = !mudo;
    tracks.forEach(t => { t.enabled = !novo; });
    setMudo(novo);
  }, [mudo]);

  // ---------- atender chamada de entrada ----------
  const atender = useCallback(async (row: ChamadaRow) => {
    if (!row.call_id || !row.sdp_offer) {
      setEntrando(null);
      toast({ title: 'Chamada indisponível', description: 'A oferta de áudio não chegou.', variant: 'destructive' });
      return;
    }
    setEstado('preparando');
    direcaoRef.current = 'entrada';
    try {

      // o microfone é pedido antes de fechar o pop-up: se o navegador bloquear,
      // a chamada continua tocando e o atendente pode tentar de novo
      const pc = await criarPc();
      setEntrando(null);
      await pc.setRemoteDescription({ type: 'offer', sdp: row.sdp_offer });
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      const sdp = await sdpCompleto(pc);
      setAlvo({ contato_id: row.contato_id, instancia_id: row.instancia_id!, telefone: row.telefone });
      const { data, error } = await supabase.functions.invoke('meta-call-action', {
        body: { acao: 'accept', call_id: row.call_id, instancia_id: row.instancia_id, sdp },
      });
      if (error || !data?.ok) throw new Error(await erroLegivel(error, data));
      callIdRef.current = row.call_id;
      chamadaIdRef.current = row.id;
      setSegundos(0);
      setEstado('em_andamento');
    } catch (e) {
      const bruto = e instanceof Error ? e.message : 'Erro ao atender';
      const nome = (e as any)?.name ?? '';
      const msg = /NotAllowedError|Permission denied|NotFoundError|microphone/i.test(`${nome} ${bruto}`)
        ? 'Permita o acesso ao microfone no navegador para atender a chamada.'
        : bruto;
      limpar();
      toast({ title: 'Não foi possível atender', description: msg, variant: 'destructive' });
    }
  }, [criarPc, limpar, toast]);


  const rejeitar = useCallback(async (row: ChamadaRow) => {
    // fecha o pop-up (e o bip) antes de falar com a Meta
    setEntrando(null);
    if (!row.call_id) return;
    await supabase.functions.invoke('meta-call-action', {
      body: { acao: 'reject', call_id: row.call_id, instancia_id: row.instancia_id },
    }).catch(() => undefined);
  }, []);

  // rede de segurança: nenhuma chamada da Meta fica tocando mais de ~45s
  useEffect(() => {
    if (!entrando) return;
    const t = setTimeout(() => setEntrando(null), 45_000);
    return () => clearTimeout(t);
  }, [entrando?.id]);

  // ---------- realtime: respostas SDP, encerramentos e chamadas de entrada ----------

  useEffect(() => {
    const ch = supabase.channel('meta-chamadas-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_chamadas' }, async (payload) => {
        const row = payload.new as ChamadaRow | undefined;
        if (!row) return;

        // chamada de entrada tocando — toca para o atendente vinculado à conversa.
        // Sem atendente identificado, cai para os administradores (rede de segurança).
        if (row.tipo_chamada === 'entrada' && row.status === 'ringing' && row.sdp_offer && estado === 'idle') {
          const paraMim = row.funcionario_id
            ? row.funcionario_id === meuIdRef.current
            : souAdminRef.current;
          if (paraMim) setEntrando(row);
          return;
        }


        // a chamada exibida no pop-up deixou de tocar -> fecha e para o toque
        if (row.status !== 'ringing') {
          setEntrando(prev => (prev && (prev.id === row.id || prev.call_id === row.call_id) ? null : prev));
        }

        if (!callIdRef.current || row.call_id !== callIdRef.current) return;


        // resposta SDP do cliente — só vale para chamadas de saída aguardando resposta
        const pc = pcRef.current;
        if (
          row.sdp_answer && !answerAplicadaRef.current && pc &&
          direcaoRef.current === 'saida' && pc.signalingState === 'have-local-offer'
        ) {
          answerAplicadaRef.current = true;
          try {
            await pc.setRemoteDescription({ type: 'answer', sdp: row.sdp_answer });
            setSegundos(0);
            setEstado('em_andamento');
          } catch (e) {
            console.error('[chamada] falha ao aplicar resposta de áudio', e);
            if (estado !== 'em_andamento') {
              toast({ title: 'Falha no áudio da chamada', variant: 'destructive' });
            }
          }
        }


        if (['concluida', 'perdida', 'rejeitada', 'erro'].includes(row.status)) {
          const rotulos: Record<string, string> = {
            concluida: 'Chamada encerrada', perdida: 'Cliente não atendeu',
            rejeitada: 'Chamada recusada pelo cliente', erro: 'Chamada com erro',
          };
          toast({ title: rotulos[row.status] ?? 'Chamada encerrada', description: row.erro || undefined });
          limpar();
        }
      })
      .subscribe((st) => {
        if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') {
          setTimeout(() => { try { void ch.subscribe(); } catch { /* canal já removido */ } }, 3000);
        }
      });

    // se a aba ficou em segundo plano ou a internet caiu, garante a reconexão
    const revisar = () => {
      if (document.visibilityState !== 'visible') return;
      const st = (ch as any).state;
      if (st !== 'joined' && st !== 'joining') {
        try { void ch.subscribe(); } catch { /* canal já removido */ }
      }
    };
    document.addEventListener('visibilitychange', revisar);
    window.addEventListener('online', revisar);

    return () => {
      document.removeEventListener('visibilitychange', revisar);
      window.removeEventListener('online', revisar);
      void supabase.removeChannel(ch);
    };
  }, [estado, limpar, toast]);

  // pega uma chamada que já estava tocando (ex.: página recarregada durante o toque)
  useEffect(() => {
    const buscarTocando = async () => {
      if (document.visibilityState !== 'visible' || estado !== 'idle' || entrando) return;
      const desde = new Date(Date.now() - 45_000).toISOString();
      const { data } = await supabase.from('whatsapp_chamadas')
        .select('*')
        .eq('tipo_chamada', 'entrada')
        .eq('status', 'ringing')
        .gte('atualizado_em', desde)
        .order('atualizado_em', { ascending: false })
        .limit(5);
      const row = (data ?? []).find((r: any) => r.sdp_offer && (
        r.funcionario_id ? r.funcionario_id === meuIdRef.current : souAdminRef.current
      ));
      if (row) setEntrando(row as ChamadaRow);
    };
    void buscarTocando();
    const onVis = () => { void buscarTocando(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);


  // permissões em tempo real (o cliente aceitou o pedido)
  useEffect(() => {
    const ch = supabase.channel('meta-call-perms')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meta_call_permissions' }, async (payload) => {
        const row = payload.new as any;
        if (!row?.instancia_id) return;
        setPermissoes(prev => ({
          ...prev,
          [`${row.instancia_id}:${dig(row.telefone)}`]: { status: row.status, expira_em: row.expira_em },
        }));
        if (row.status !== 'accepted') return;

        const tel = dig(row.telefone);
        const { data: ct } = await supabase.from('meta_whatsapp_contatos')
          .select('id, nome, telefone')
          .eq('instancia_id', row.instancia_id)
          .like('telefone', `%${tel.slice(-8)}`)
          .limit(1)
          .maybeSingle();
        const quem = [ct?.nome, ct?.telefone || tel].filter(Boolean).join(' — ');
        toast({
          title: 'Cliente autorizou a chamada',
          description: `${quem}. Abra a conversa para ligar.`,
          action: (
            <ToastAction
              altText="Abrir conversa"
              onClick={() => navigate(
                `/admin/inbox-meta?contato=${ct?.id ?? ''}&telefone=${tel}&instancia=${row.instancia_id}`,
              )}
            >
              Abrir conversa
            </ToastAction>
          ),
        });
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [toast, navigate]);

  const value = useMemo<Ctx>(() => ({
    estado, alvo, segundos, mudo, ligar, pedirPermissao, ligarOuPedirPermissao, encerrar, alternarMudo, permissaoDe,
    recarregarPermissoes, revalidarPermissao, chamadasHabilitadas, recarregarInstanciasComChamada,
  }), [estado, alvo, segundos, mudo, ligar, pedirPermissao, ligarOuPedirPermissao, encerrar, alternarMudo, permissaoDe,
    recarregarPermissoes, revalidarPermissao, chamadasHabilitadas, recarregarInstanciasComChamada]);



  return (
    <MetaCallContext.Provider value={value}>
      {children}
      <ChamadaFlutuante />
      <ChamadaEntrandoDialog
        chamada={entrando}
        onAtender={atender}
        onRejeitar={rejeitar}
        onFechar={() => setEntrando(null)}
      />
    </MetaCallContext.Provider>
  );
}

export function useMetaCall() {
  const ctx = useContext(MetaCallContext);
  if (!ctx) throw new Error('useMetaCall precisa estar dentro de MetaCallProvider');
  return ctx;
}
