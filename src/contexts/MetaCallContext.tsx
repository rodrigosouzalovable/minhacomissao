import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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
  encerrar: () => Promise<void>;
  alternarMudo: () => void;
  permissaoDe: (instanciaId: string, telefone: string) => 'accepted' | 'pending' | 'rejected' | 'none';
  recarregarPermissoes: () => Promise<void>;
  /** true quando o número oficial já tem chamadas de voz ligadas. */
  chamadasHabilitadas: (instanciaId: string) => boolean;
  recarregarInstanciasComChamada: () => Promise<void>;
};


const MetaCallContext = createContext<Ctx | null>(null);

const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
const dig = (v?: string | null) => String(v ?? '').replace(/\D/g, '');

export function MetaCallProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const [estado, setEstado] = useState<EstadoChamada>('idle');
  const [alvo, setAlvo] = useState<Alvo | null>(null);
  const [segundos, setSegundos] = useState(0);
  const [mudo, setMudo] = useState(false);
  const [entrando, setEntrando] = useState<ChamadaRow | null>(null);
  const [permissoes, setPermissoes] = useState<Record<string, { status: string; expira_em: string | null }>>({});
  const [comChamada, setComChamada] = useState<Set<string>>(new Set());


  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const callIdRef = useRef<string | null>(null);
  const chamadaIdRef = useRef<string | null>(null);
  const answerAplicadaRef = useRef(false);

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

  // ---------- pedido de permissão ----------
  const pedirPermissao = useCallback(async (a: Alvo) => {
    const { data, error } = await supabase.functions.invoke('meta-call-permission-request', {
      body: {
        instancia_id: a.instancia_id, telefone: dig(a.telefone),
        contato_id: a.contato_id ?? null, nome: (a.nome || '').split(' ')[0] || 'cliente',
      },
    });
    if (error || !data?.ok) {
      toast({
        title: 'Não foi possível pedir a permissão',
        description: data?.error || error?.message || 'Erro desconhecido',
        variant: 'destructive',
      });
      return false;
    }
    toast({
      title: 'Pedido de chamada enviado',
      description: 'Quando o cliente tocar em "Aceitar chamada", o botão de ligar fica liberado.',
    });
    await recarregarPermissoes();
    return true;
  }, [toast, recarregarPermissoes]);

  // ---------- chamada de saída ----------
  const ligar = useCallback(async (a: Alvo) => {
    if (estado !== 'idle') {
      toast({ title: 'Já existe uma chamada em andamento', variant: 'destructive' });
      return;
    }
    setAlvo(a);
    setEstado('preparando');
    try {
      const pc = await criarPc();
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      const sdp = await sdpCompleto(pc);

      const { data, error } = await supabase.functions.invoke('meta-call-start', {
        body: { instancia_id: a.instancia_id, telefone: dig(a.telefone), contato_id: a.contato_id ?? null, sdp },
      });
      if (error) throw new Error(error.message);
      if (!data?.ok) {
        if (data?.precisa_permissao) {
          limpar();
          await pedirPermissao(a);
          return;
        }
        throw new Error(data?.error || 'Falha ao iniciar a chamada');
      }
      callIdRef.current = data.call_id;
      chamadaIdRef.current = data.chamada_id ?? null;
      setEstado('chamando');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao ligar';
      limpar();
      toast({ title: 'Chamada não iniciada', description: msg, variant: 'destructive' });
    }
  }, [estado, criarPc, toast, limpar, pedirPermissao]);

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
    setEntrando(null);
    if (!row.call_id || !row.sdp_offer) {
      toast({ title: 'Chamada indisponível', description: 'A oferta de áudio não chegou.', variant: 'destructive' });
      return;
    }
    setAlvo({ contato_id: row.contato_id, instancia_id: row.instancia_id!, telefone: row.telefone });
    setEstado('preparando');
    try {
      const pc = await criarPc();
      await pc.setRemoteDescription({ type: 'offer', sdp: row.sdp_offer });
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      const sdp = await sdpCompleto(pc);
      const { data, error } = await supabase.functions.invoke('meta-call-action', {
        body: { acao: 'accept', call_id: row.call_id, instancia_id: row.instancia_id, sdp },
      });
      if (error) throw new Error(error.message);
      if (!data?.ok) throw new Error(data?.error || 'Falha ao atender');
      callIdRef.current = row.call_id;
      chamadaIdRef.current = row.id;
      setSegundos(0);
      setEstado('em_andamento');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao atender';
      limpar();
      toast({ title: 'Não foi possível atender', description: msg, variant: 'destructive' });
    }
  }, [criarPc, limpar, toast]);

  const rejeitar = useCallback(async (row: ChamadaRow) => {
    setEntrando(null);
    if (!row.call_id) return;
    await supabase.functions.invoke('meta-call-action', {
      body: { acao: 'reject', call_id: row.call_id, instancia_id: row.instancia_id },
    }).catch(() => undefined);
  }, []);

  // ---------- realtime: respostas SDP, encerramentos e chamadas de entrada ----------
  useEffect(() => {
    const ch = supabase.channel('meta-chamadas-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_chamadas' }, async (payload) => {
        const row = payload.new as ChamadaRow | undefined;
        if (!row) return;

        // chamada de entrada tocando
        if (row.tipo_chamada === 'entrada' && row.status === 'ringing' && row.sdp_offer && estado === 'idle') {
          setEntrando(row);
          return;
        }

        if (!callIdRef.current || row.call_id !== callIdRef.current) return;

        // resposta SDP do cliente (chamada de saída aceita)
        if (row.sdp_answer && !answerAplicadaRef.current && pcRef.current) {
          answerAplicadaRef.current = true;
          try {
            await pcRef.current.setRemoteDescription({ type: 'answer', sdp: row.sdp_answer });
            setSegundos(0);
            setEstado('em_andamento');
          } catch {
            toast({ title: 'Falha no áudio da chamada', variant: 'destructive' });
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
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [estado, limpar, toast]);

  // permissões em tempo real (o cliente aceitou o pedido)
  useEffect(() => {
    const ch = supabase.channel('meta-call-perms')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meta_call_permissions' }, (payload) => {
        const row = payload.new as any;
        if (!row?.instancia_id) return;
        setPermissoes(prev => ({
          ...prev,
          [`${row.instancia_id}:${dig(row.telefone)}`]: { status: row.status, expira_em: row.expira_em },
        }));
        if (row.status === 'accepted') {
          toast({ title: 'Cliente autorizou a chamada', description: 'Você já pode ligar para esse número.' });
        }
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [toast]);

  const value = useMemo<Ctx>(() => ({
    estado, alvo, segundos, mudo, ligar, pedirPermissao, encerrar, alternarMudo, permissaoDe, recarregarPermissoes,
    chamadasHabilitadas, recarregarInstanciasComChamada,
  }), [estado, alvo, segundos, mudo, ligar, pedirPermissao, encerrar, alternarMudo, permissaoDe, recarregarPermissoes,
    chamadasHabilitadas, recarregarInstanciasComChamada]);


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
