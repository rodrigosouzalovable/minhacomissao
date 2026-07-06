import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search, Send, Loader2, ShieldCheck, AlertCircle, Clock, Tag, X, Pin,
  Archive, Trash2, Paperclip, Reply, CheckSquare, Square, ChevronDown,
  Mic, AudioLines, FileText, Zap, Sun, Moon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChatMessage } from '@/components/inbox/ChatMessage';
import { MetaConversaContextMenu } from '@/components/inbox/meta/MetaConversaContextMenu';
import { MetaEtiquetasDialog, MetaEtiqueta } from '@/components/inbox/meta/MetaEtiquetasDialog';
import { MetaMensagensRapidasDialog, MetaMsgRapida } from '@/components/inbox/meta/MetaMensagensRapidasDialog';

import { MetaComposer, type MetaComposerHandle } from '@/components/inbox/meta/MetaComposer';
import { useMetaAudioRecorder } from '@/hooks/useMetaAudioRecorder';
import { MetaInstanceHealthBanner } from '@/components/inbox/meta/MetaInstanceHealthBanner';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';

interface MetaInstance {
  id: string; nome: string | null; display_phone: string | null; ativo: boolean;
  saude_status?: string | null;
  saude_quality?: string | null;
  saude_name_status?: string | null;
  saude_ban_info?: any;
  saude_checked_at?: string | null;
}
interface MetaContato {
  id: string; instancia_id: string; telefone: string; nome: string | null;
  ultima_mensagem: string | null; ultima_mensagem_em: string | null;
  ultima_msg_entrada_em: string | null; nao_lido: number;
  fixado: boolean; arquivado: boolean;
  // Meta 2026 — WhatsApp Username + BSUID
  bsuid?: string | null;
  whatsapp_username?: string | null;
  telefone_visivel?: boolean | null;
}
interface MetaMensagem {
  id: string; instancia_id: string; telefone: string; conteudo: string;
  direcao: string; timestamp_msg: string; tipo_conteudo?: string;
  media_url?: string | null; wa_message_id?: string | null; status_envio?: string | null;
  wa_message_id_reply?: string | null; conteudo_citado?: string | null;
}

const PAGE_SIZE = 200;
const JANELA_24H_MS = 24 * 60 * 60 * 1000;

function formatTelefone(t: string) {
  const d = t.replace(/\D/g, '');
  if (d.length >= 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9, 13)}`;
  if (d.length >= 12) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  return t;
}
function formatMsgTime(ts: string) { try { return format(new Date(ts), 'HH:mm', { locale: ptBR }); } catch { return ''; } }
function formatContatoTime(ts: string | null) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    if (d.toDateString() === new Date().toDateString()) return format(d, 'HH:mm');
    return format(d, 'dd/MM', { locale: ptBR });
  } catch { return ''; }
}

export default function InboxMeta() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [instancias, setInstancias] = useState<MetaInstance[]>([]);
  const [filtroInstancia, setFiltroInstancia] = useState<string>('todas');
  const [contatos, setContatos] = useState<MetaContato[]>([]);
  const [contatoAtivo, setContatoAtivo] = useState<MetaContato | null>(null);
  const [mensagens, setMensagens] = useState<MetaMensagem[]>([]);
  const [busca, setBusca] = useState('');
  // texto local vive no Composer (evita re-render do inbox inteiro por tecla)
  const [enviando, setEnviando] = useState(false);
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);
  const [carregandoMsgs, setCarregandoMsgs] = useState(false);
  const [paginaAtual, setPaginaAtual] = useState(0);
  const [temMaisAnteriores, setTemMaisAnteriores] = useState(true);
  const [carregandoAnteriores, setCarregandoAnteriores] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<'conversas' | 'arquivados'>('conversas');
  const [filtroLeitura, setFiltroLeitura] = useState<'todas' | 'nao_lidas'>('todas');

  const [etiquetas, setEtiquetas] = useState<MetaEtiqueta[]>([]);
  const [contatoEtiquetas, setContatoEtiquetas] = useState<Record<string, string[]>>({});
  const [filtroEtiqueta, setFiltroEtiqueta] = useState<string | null>(null);
  const [filtroEtOpen, setFiltroEtOpen] = useState(false);
  const [nomesCRM, setNomesCRM] = useState<Record<string, string>>({}); // suffix8 -> nome do devedor

  
  const [etiquetasOpen, setEtiquetasOpen] = useState(false);
  const [msgRapidasOpen, setMsgRapidasOpen] = useState(false);
  const [msgRapidas, setMsgRapidas] = useState<MetaMsgRapida[]>([]);

  const [selMultipla, setSelMultipla] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [respondendo, setRespondendo] = useState<MetaMensagem | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<MetaComposerHandle>(null);
  const [modoGravacao, setModoGravacao] = useState<'audio' | 'transcrito'>('audio');
  const themeStorageKey = user ? `inbox-meta-theme:${user.id}` : 'inbox-meta-theme';
  const [tema, setTema] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    try {
      const k = user ? `inbox-meta-theme:${user.id}` : 'inbox-meta-theme';
      return (localStorage.getItem(k) as 'light' | 'dark') || 'light';
    } catch { return 'light'; }
  });
  useEffect(() => {
    if (!user) return;
    try {
      const saved = localStorage.getItem(themeStorageKey) as 'light' | 'dark' | null;
      if (saved) setTema(saved);
    } catch {}
  }, [user, themeStorageKey]);
  const toggleTema = () => {
    setTema(prev => {
      const next = prev === 'light' ? 'dark' : 'light';
      try { localStorage.setItem(themeStorageKey, next); } catch {}
      return next;
    });
  };

  // ============== Carregamento ==============
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('meta_whatsapp_instances')
        .select('id, nome, display_phone, ativo, saude_status, saude_quality, saude_name_status, saude_ban_info, saude_checked_at')
        .eq('ativo', true).order('nome');
      setInstancias((data as MetaInstance[]) ?? []);
    })();
  }, [user]);

  const fetchEtiquetas = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('meta_whatsapp_etiquetas')
      .select('id, nome, cor').order('nome');
    setEtiquetas((data as MetaEtiqueta[]) ?? []);
  }, [user]);

  const fetchContatoEtiquetas = useCallback(async () => {
    const { data } = await supabase.from('meta_whatsapp_contato_etiquetas')
      .select('contato_id, etiqueta_id');
    const map: Record<string, string[]> = {};
    (data ?? []).forEach((r: any) => {
      if (!map[r.contato_id]) map[r.contato_id] = [];
      map[r.contato_id].push(r.etiqueta_id);
    });
    setContatoEtiquetas(map);
  }, []);

  const fetchMsgRapidas = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('meta_whatsapp_mensagens_rapidas')
      .select('id, titulo, tipo, conteudo, audio_url').eq('user_id', user.id).order('ordem');
    setMsgRapidas((data as MetaMsgRapida[]) ?? []);
  }, [user]);

  useEffect(() => { fetchEtiquetas(); fetchContatoEtiquetas(); fetchMsgRapidas(); }, [fetchEtiquetas, fetchContatoEtiquetas, fetchMsgRapidas]);

  const fetchContatos = useCallback(async () => {
    if (!user) return;
    let q = supabase.from('meta_whatsapp_contatos')
      .select('id, instancia_id, telefone, nome, ultima_mensagem, ultima_mensagem_em, ultima_msg_entrada_em, nao_lido, fixado, arquivado')
      .eq('arquivado', abaAtiva === 'arquivados')
      .order('ultima_mensagem_em', { ascending: false, nullsFirst: false })
      .limit(500);
    if (filtroInstancia !== 'todas') q = q.eq('instancia_id', filtroInstancia);
    const { data } = await q;
    setContatos((data as MetaContato[]) ?? []);
  }, [user, filtroInstancia, abaAtiva]);

  useEffect(() => { fetchContatos(); }, [fetchContatos]);

  // Realtime + polling fallback
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('meta-inbox-contatos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meta_whatsapp_contatos' }, () => {
        fetchContatos();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meta_whatsapp_contato_etiquetas' }, () => {
        fetchContatoEtiquetas();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meta_whatsapp_etiquetas' }, () => {
        fetchEtiquetas();
      })
      .subscribe();
    const poll = setInterval(() => fetchContatos(), 20000);
    const onVis = () => { if (!document.hidden) fetchContatos(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { supabase.removeChannel(channel); clearInterval(poll); document.removeEventListener('visibilitychange', onVis); };
  }, [user, fetchContatos, fetchContatoEtiquetas, fetchEtiquetas]);

  // ============== Mensagens ==============
  const fetchMensagens = useCallback(async (contato: MetaContato, loadMore = false) => {
    if (loadMore) setCarregandoAnteriores(true); else setCarregandoMsgs(true);
    const offset = loadMore ? (paginaAtual + 1) * PAGE_SIZE : 0;
    const { data, count } = await supabase
      .from('meta_whatsapp_mensagens')
      .select('*', { count: 'exact' })
      .eq('instancia_id', contato.instancia_id)
      .eq('telefone', contato.telefone)
      .eq('apagada_para_mim', false)
      .order('timestamp_msg', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    const lista = ((data as MetaMensagem[]) ?? []).reverse();
    if (loadMore) {
      const container = chatContainerRef.current;
      const oldH = container?.scrollHeight || 0;
      setMensagens(prev => {
        const ids = new Set(prev.map(m => m.id));
        return [...lista.filter(m => !ids.has(m.id)), ...prev];
      });
      setPaginaAtual(p => p + 1);
      setTemMaisAnteriores(((paginaAtual + 2) * PAGE_SIZE) < (count ?? 0));
      requestAnimationFrame(() => {
        if (container) container.scrollTop = container.scrollHeight - oldH;
      });
      setCarregandoAnteriores(false);
    } else {
      setMensagens(lista);
      setPaginaAtual(0);
      setTemMaisAnteriores(PAGE_SIZE < (count ?? 0));
      setCarregandoMsgs(false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 50);
      if (contato.nao_lido > 0) {
        setContatos(prev => prev.map(c => c.id === contato.id ? { ...c, nao_lido: 0 } : c));
        await supabase.from('meta_whatsapp_contatos').update({ nao_lido: 0 }).eq('id', contato.id);
      }
    }
  }, [paginaAtual]);

  useEffect(() => {
    if (contatoAtivo) fetchMensagens(contatoAtivo, false);
    else setMensagens([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contatoAtivo?.id]);

  // Refresh saúde da instância em background (no máx 1x a cada 30 min por instância aberta)
  useEffect(() => {
    if (!contatoAtivo?.instancia_id) return;
    const inst = instancias.find(i => i.id === contatoAtivo.instancia_id);
    if (!inst) return;
    const checkedAt = inst.saude_checked_at ? new Date(inst.saude_checked_at).getTime() : 0;
    if (checkedAt && Date.now() - checkedAt < 30 * 60 * 1000) return;
    (async () => {
      try {
        await supabase.functions.invoke('check-meta-instance-health', { body: { instancia_id: inst.id } });
        const { data } = await supabase.from('meta_whatsapp_instances')
          .select('id, nome, display_phone, ativo, saude_status, saude_quality, saude_name_status, saude_ban_info, saude_checked_at')
          .eq('id', inst.id).maybeSingle();
        if (data) {
          setInstancias(prev => prev.map(p => p.id === inst.id ? { ...p, ...(data as MetaInstance) } : p));
        }
      } catch { /* silencioso — banner só aparece se houver problema */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contatoAtivo?.instancia_id]);

  // Realtime mensagens
  useEffect(() => {
    if (!contatoAtivo) return;
    const channel = supabase
      .channel(`meta-msgs-${contatoAtivo.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'meta_whatsapp_mensagens', filter: `instancia_id=eq.${contatoAtivo.instancia_id}` },
        (payload) => {
          const row = (payload.new || payload.old) as MetaMensagem;
          if (!row || row.telefone !== contatoAtivo.telefone) return;
          if (payload.eventType === 'INSERT') {
            setMensagens(prev => prev.some(m => m.id === row.id) ? prev : [...prev, row]);
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 30);
          } else if (payload.eventType === 'UPDATE') {
            setMensagens(prev => prev.map(m => m.id === row.id ? { ...m, ...row } : m));
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [contatoAtivo]);

  // Scroll infinito
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container || !contatoAtivo) return;
    const onScroll = () => {
      if (container.scrollTop < 100 && temMaisAnteriores && !carregandoAnteriores && !carregandoMsgs) {
        fetchMensagens(contatoAtivo, true);
      }
    };
    container.addEventListener('scroll', onScroll);
    return () => container.removeEventListener('scroll', onScroll);
  }, [contatoAtivo, temMaisAnteriores, carregandoAnteriores, carregandoMsgs, fetchMensagens]);

  // ============== Filtros derivados ==============
  const norm = (s: string) =>
    (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const suffix8 = (tel: string) => (tel || '').replace(/\D/g, '').slice(-8);

  // Carrega nomes do CRM (devedores) para contatos que não têm nome salvo
  useEffect(() => {
    (async () => {
      const semNome = contatos.filter(c => !c.nome && c.telefone);
      if (semNome.length === 0) return;
      const suffixes = Array.from(new Set(semNome.map(c => suffix8(c.telefone)).filter(Boolean)));
      const faltando = suffixes.filter(s => !(s in nomesCRM));
      if (faltando.length === 0) return;
      const ors = faltando.map(s => `telefone.ilike.%${s}`).join(',');
      const { data } = await supabase.from('devedores').select('nome, telefone').or(ors).limit(2000);
      if (!data) return;
      setNomesCRM(prev => {
        const next = { ...prev };
        for (const s of faltando) if (!(s in next)) next[s] = '';
        for (const row of data as any[]) {
          const sfx = suffix8(row.telefone || '');
          if (sfx && row.nome && !next[sfx]) next[sfx] = row.nome;
        }
        return next;
      });
    })();
  }, [contatos]); // eslint-disable-line react-hooks/exhaustive-deps

  const contatosFiltrados = useMemo(() => {
    const bRaw = busca.trim();
    const b = norm(bRaw);
    const bDigits = bRaw.replace(/\D/g, '');
    const bTemDigito = /\d/.test(bRaw);
    const bSuffix = bDigits.slice(-8);
    return contatos
      .filter(c => {
        if (b) {
          const nomeContato = norm(c.nome || '');
          const nomeCRM = norm(nomesCRM[suffix8(c.telefone)] || '');
          const telDigits = (c.telefone || '').replace(/\D/g, '');
          const telSfx = telDigits.slice(-8);
          const matchTexto = nomeContato.includes(b) || (nomeCRM && nomeCRM.includes(b));
          const matchTel = bTemDigito && bDigits.length > 0 &&
            (telDigits.includes(bDigits) || (bSuffix.length >= 4 && telSfx.includes(bSuffix)));
          if (!matchTexto && !matchTel) return false;
        }
        if (filtroEtiqueta) {
          const ids = contatoEtiquetas[c.id] || [];
          if (!ids.includes(filtroEtiqueta)) return false;
        }
        if (filtroLeitura === 'nao_lidas' && !(c.nao_lido > 0)) return false;
        return true;
      })
      .sort((a, b) => {
        const rank = (c: MetaContato) => (c.fixado ? 0 : 1);
        const ra = rank(a), rb = rank(b);
        if (ra !== rb) return ra - rb;
        const ta = a.ultima_mensagem_em ? new Date(a.ultima_mensagem_em).getTime() : 0;
        const tb = b.ultima_mensagem_em ? new Date(b.ultima_mensagem_em).getTime() : 0;
        return tb - ta;
      });
  }, [contatos, busca, filtroEtiqueta, contatoEtiquetas, filtroLeitura, nomesCRM]);

  const janelaInfo = useMemo(() => {
    if (!contatoAtivo?.ultima_msg_entrada_em) return { aberta: false, expiraEm: null as string | null };
    const fim = new Date(contatoAtivo.ultima_msg_entrada_em).getTime() + JANELA_24H_MS;
    return { aberta: fim - Date.now() > 0, expiraEm: new Date(fim).toISOString() };
  }, [contatoAtivo]);

  const instAtiva = useMemo(() => instancias.find(i => i.id === contatoAtivo?.instancia_id), [instancias, contatoAtivo]);

  // ============== Envio ==============
  const enviar = async (textoCustom?: string) => {
    const t = (textoCustom ?? '').trim();
    if (!contatoAtivo || !t || enviando) return;
    if (!janelaInfo.aberta) {
      toast({ title: 'Janela 24h expirada', description: 'Use um template HSM em "Envio Meta (massa)".', variant: 'destructive' });
      return;
    }
    setEnviando(true);
    const tempId = `temp-${Date.now()}`;
    const tempMsg: MetaMensagem = {
      id: tempId, instancia_id: contatoAtivo.instancia_id, telefone: contatoAtivo.telefone,
      conteudo: t, direcao: 'saida', timestamp_msg: new Date().toISOString(),
      tipo_conteudo: 'texto', status_envio: 'enviando',
      wa_message_id_reply: respondendo?.wa_message_id || null,
      conteudo_citado: respondendo?.conteudo || null,
    };
    setMensagens(prev => [...prev, tempMsg]);
    const replyTo = respondendo?.wa_message_id;
    const replySnap = respondendo?.conteudo;
    setRespondendo(null);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 30);

    try {
      const { data, error } = await supabase.functions.invoke('send-whatsapp-meta-text', {
        body: {
          instancia_id: contatoAtivo.instancia_id,
          telefone: contatoAtivo.telefone || undefined,
          bsuid: contatoAtivo.bsuid || undefined,
          texto: t,
          user_id: user?.id,
          reply_to_wa_id: replyTo,
          conteudo_citado: replySnap,
        },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Falha');
      setMensagens(prev => prev.filter(m => m.id !== tempId));
    } catch (e: any) {
      setMensagens(prev => prev.map(m => m.id === tempId ? { ...m, status_envio: 'erro' } : m));
      toast({ title: 'Erro ao enviar', description: e.message, variant: 'destructive' });
    } finally {
      setEnviando(false);
    }
  };

  const audioRec = useMetaAudioRecorder({
    instanciaId: contatoAtivo?.instancia_id || '',
    telefone: contatoAtivo?.telefone || '',
    userId: user?.id,
    replyToWaId: respondendo?.wa_message_id || undefined,
    conteudoCitado: respondendo?.conteudo || undefined,
    onSent: () => setRespondendo(null),
  });

  const iniciarGravacaoModo = async (modo: 'audio' | 'transcrito') => {
    if (!contatoAtivo || !janelaInfo.aberta) return;
    setModoGravacao(modo);
    await audioRec.iniciarGravacao();
  };

  const finalizarGravacao = async () => {
    if (modoGravacao === 'transcrito') {
      const texto = await audioRec.transcreverGravacao();
      if (texto) {
        composerRef.current?.appendText(texto);
        toast({ title: 'Áudio transcrito', description: 'Revise o texto e clique em enviar.' });
      }
    } else {
      await audioRec.enviarGravacao();
    }
  };

  const enviarMidia = async (file: File) => {
    if (!contatoAtivo) return;
    if (!janelaInfo.aberta) {
      toast({ title: 'Janela 24h expirada', variant: 'destructive' });
      return;
    }
    const isImage = file.type.startsWith('image/');
    const isAudio = file.type.startsWith('audio/');
    const isVideo = file.type.startsWith('video/');
    const isPdf = file.type === 'application/pdf';
    if (!isImage && !isAudio && !isVideo && !isPdf) {
      toast({ title: 'Arquivo inválido', description: 'Envie imagem, áudio, vídeo ou PDF', variant: 'destructive' });
      return;
    }
    setEnviandoArquivo(true);
    try {
      const ext = file.name.split('.').pop() || 'bin';
      const path = `meta/${contatoAtivo.instancia_id}/${contatoAtivo.telefone}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('inbox-media').upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('inbox-media').getPublicUrl(path);
      const type = isImage ? 'image' : isAudio ? 'audio' : isVideo ? 'video' : 'document';
      const { data, error } = await supabase.functions.invoke('send-whatsapp-meta-media', {
        body: {
          instancia_id: contatoAtivo.instancia_id,
          telefone: contatoAtivo.telefone || undefined,
          bsuid: contatoAtivo.bsuid || undefined,
          media_url: urlData.publicUrl,
          type,
          file_name: file.name,
          user_id: user?.id,
          reply_to_wa_id: respondendo?.wa_message_id,
          conteudo_citado: respondendo?.conteudo,
        },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Falha');
      setRespondendo(null);
    } catch (e: any) {
      toast({ title: 'Erro ao enviar mídia', description: e.message, variant: 'destructive' });
    } finally {
      setEnviandoArquivo(false);
    }
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items; if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const f = items[i].getAsFile();
        if (f) enviarMidia(new File([f], `clipboard-${Date.now()}.png`, { type: f.type }));
        return;
      }
    }
  };

  // ============== Ações conversa ==============
  const handleFixar = async (id: string, fix: boolean) => {
    await supabase.from('meta_whatsapp_contatos').update({ fixado: fix }).eq('id', id);
  };
  const handleArquivar = async (id: string, arq: boolean) => {
    await supabase.from('meta_whatsapp_contatos').update({ arquivado: arq }).eq('id', id);
    if (contatoAtivo?.id === id) setContatoAtivo(null);
  };
  const handleMarcarNaoLida = (id: string) => {
    setContatos(prev => prev.map(c => c.id === id ? { ...c, nao_lido: Math.max(c.nao_lido || 0, 1) } : c));
    setContatoAtivo(prev => prev?.id === id ? { ...prev, nao_lido: Math.max(prev.nao_lido || 0, 1) } : prev);
  };
  const handleEtiquetaToggle = (cId: string, eId: string, ativo: boolean) => {
    setContatoEtiquetas(prev => {
      const ids = prev[cId] || [];
      return { ...prev, [cId]: ativo ? [...ids, eId] : ids.filter(x => x !== eId) };
    });
  };
  const handleExcluirConversa = async (id: string) => {
    if (!confirm('Excluir esta conversa e todas as mensagens?')) return;
    const c = contatos.find(x => x.id === id);
    if (!c) return;
    await supabase.from('meta_whatsapp_mensagens').delete()
      .eq('instancia_id', c.instancia_id).eq('telefone', c.telefone);
    await supabase.from('meta_whatsapp_contatos').delete().eq('id', id);
    if (contatoAtivo?.id === id) setContatoAtivo(null);
    toast({ title: 'Conversa excluída' });
  };

  // Multi-seleção
  const toggleSel = (id: string) => {
    setSelecionados(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const sairMultipla = () => { setSelMultipla(false); setSelecionados(new Set()); };
  const arquivarSelecionados = async () => {
    if (selecionados.size === 0) return;
    await supabase.from('meta_whatsapp_contatos').update({ arquivado: abaAtiva !== 'arquivados' }).in('id', Array.from(selecionados));
    sairMultipla();
  };
  const excluirSelecionados = async () => {
    if (selecionados.size === 0 || !confirm(`Excluir ${selecionados.size} conversa(s)?`)) return;
    const ids = Array.from(selecionados);
    const cs = contatos.filter(c => ids.includes(c.id));
    for (const c of cs) {
      await supabase.from('meta_whatsapp_mensagens').delete().eq('instancia_id', c.instancia_id).eq('telefone', c.telefone);
    }
    await supabase.from('meta_whatsapp_contatos').delete().in('id', ids);
    sairMultipla();
  };

  // ============== Render ==============
  return (
    <AppLayout>
      <div className={cn(tema === 'dark' && 'dark')}>
      <div className="flex h-[calc(100vh-4rem)] gap-0 overflow-hidden bg-background text-foreground">
        {/* Sidebar */}
        <div className="w-full sm:w-[360px] sm:min-w-[360px] sm:max-w-[360px] border-r flex flex-col bg-card overflow-hidden">
          <div className="p-3 border-b space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <h2 className="text-sm font-semibold flex-1">Inbox API Oficial Meta</h2>
              <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-500">Oficial</Badge>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={toggleTema} title={tema === 'dark' ? 'Modo claro' : 'Modo escuro'}>
                {tema === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs px-2" onClick={() => setMsgRapidasOpen(true)} title="Mensagens rápidas">
                <Zap className="h-3.5 w-3.5 mr-1" /> Mensagens rápidas
              </Button>
            </div>
            <Select value={filtroInstancia} onValueChange={setFiltroInstancia}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Número Meta" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todos ({instancias.length})</SelectItem>
                {instancias.map(i => (
                  <SelectItem key={i.id} value={i.id}>{i.nome || i.display_phone || i.id.slice(0, 8)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-1.5">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome ou telefone..."
                  className="pl-7 h-8 text-xs" />
              </div>
              <Popover open={filtroEtOpen} onOpenChange={setFiltroEtOpen}>
                <PopoverTrigger asChild>
                  <Button variant={filtroEtiqueta ? 'default' : 'outline'} size="sm" className="h-8 px-2">
                    <Tag className="h-3.5 w-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-1" align="end">
                  <button
                    onClick={() => { setFiltroEtiqueta(null); setFiltroEtOpen(false); }}
                    className={cn('w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent', !filtroEtiqueta && 'bg-accent')}>
                    Todas as conversas
                  </button>
                  {etiquetas.map(et => (
                    <button key={et.id}
                      onClick={() => { setFiltroEtiqueta(et.id); setFiltroEtOpen(false); }}
                      className={cn('w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded hover:bg-accent', filtroEtiqueta === et.id && 'bg-accent')}>
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: et.cor }} />
                      <span className="truncate">{et.nome}</span>
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            </div>
            {/* Tabs */}
            <div className="flex gap-1 bg-muted/40 p-0.5 rounded">
              <button onClick={() => setAbaAtiva('conversas')}
                className={cn('flex-1 text-xs py-1 rounded transition', abaAtiva === 'conversas' ? 'bg-background shadow-sm' : 'text-muted-foreground')}>
                Conversas
              </button>
              <button onClick={() => setAbaAtiva('arquivados')}
                className={cn('flex-1 text-xs py-1 rounded transition', abaAtiva === 'arquivados' ? 'bg-background shadow-sm' : 'text-muted-foreground')}>
                Arquivados
              </button>
            </div>
            {/* Filtro leitura */}
            <div className="flex gap-1 bg-muted/40 p-0.5 rounded">
              <button onClick={() => setFiltroLeitura('todas')}
                className={cn('flex-1 text-xs py-1 rounded transition', filtroLeitura === 'todas' ? 'bg-background shadow-sm' : 'text-muted-foreground')}>
                Todas
              </button>
              <button onClick={() => setFiltroLeitura('nao_lidas')}
                className={cn('flex-1 text-xs py-1 rounded transition', filtroLeitura === 'nao_lidas' ? 'bg-background shadow-sm' : 'text-muted-foreground')}>
                Não lidas
              </button>
            </div>
            {selMultipla && (
              <div className="flex items-center gap-1 bg-primary/10 rounded p-1.5">
                <span className="text-xs flex-1">{selecionados.size} selecionada(s)</span>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={arquivarSelecionados} title={abaAtiva === 'arquivados' ? 'Desarquivar' : 'Arquivar'}>
                  <Archive className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={excluirSelecionados} title="Excluir">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={sairMultipla} title="Cancelar">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
          <ScrollArea className="flex-1 w-full max-w-full overflow-hidden">
            <div className="w-full sm:w-[360px] max-w-full overflow-hidden">
              {contatosFiltrados.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                {abaAtiva === 'arquivados' ? 'Nenhuma conversa arquivada.' : 'Nenhuma conversa.'}
              </div>
            ) : contatosFiltrados.map(c => {
              const inst = instancias.find(i => i.id === c.instancia_id);
              const ativo = contatoAtivo?.id === c.id;
              const etIds = contatoEtiquetas[c.id] || [];
              const ets = etiquetas.filter(e => etIds.includes(e.id));
              const sel = selecionados.has(c.id);
              return (
                <MetaConversaContextMenu
                  key={c.id}
                  contatoId={c.id}
                  etiquetas={etiquetas}
                  contatoEtiquetaIds={etIds}
                  fixado={c.fixado}
                  arquivado={c.arquivado}
                  onMarcarNaoLida={() => handleMarcarNaoLida(c.id)}
                  onExcluirConversa={handleExcluirConversa}
                  onEtiquetaToggle={handleEtiquetaToggle}
                  onEtiquetasChange={fetchEtiquetas}
                  onFixarToggle={handleFixar}
                  onArquivarToggle={handleArquivar}
                >
                  <button
                    onClick={() => selMultipla ? toggleSel(c.id) : setContatoAtivo(c)}
                    onDoubleClick={() => { if (!selMultipla) { setSelMultipla(true); toggleSel(c.id); } }}
                    className={cn(
                      'relative block w-full max-w-full min-h-[76px] text-left px-3 py-3 pr-14 border-b hover:bg-accent/50 transition overflow-hidden',
                      ativo && 'bg-accent',
                      sel && 'bg-primary/15',
                      c.nao_lido > 0 && !ativo && 'bg-emerald-500/5',
                    )}>
                    <div className="min-w-0 space-y-1">
                      <span className={cn(
                        'text-sm truncate flex items-center gap-1',
                        c.nao_lido > 0 ? 'font-bold text-foreground' : 'font-medium',
                      )}>
                        {selMultipla && (sel ? <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" /> : <Square className="h-3.5 w-3.5 text-muted-foreground shrink-0" />)}
                        {c.fixado && <Pin className="h-3 w-3 text-amber-500 shrink-0" />}
                        <span className="truncate">{c.nome || nomesCRM[suffix8(c.telefone)] || (c.telefone ? formatTelefone(c.telefone) : (c.whatsapp_username ? `@${c.whatsapp_username}` : 'Sem telefone'))}</span>
                        {!c.telefone && c.bsuid && <Badge variant="outline" className="text-[9px] py-0 h-3.5 px-1 shrink-0">BSUID</Badge>}
                      </span>
                      <span className={cn(
                        'block text-xs truncate',
                        c.nao_lido > 0 ? 'text-foreground font-medium' : 'text-muted-foreground',
                      )}>{c.ultima_mensagem || '—'}</span>
                    </div>
                    <div className="absolute right-3 top-3 bottom-3 w-9 shrink-0 flex flex-col items-end justify-between pointer-events-none">
                      <span className={cn(
                        'text-[10px] whitespace-nowrap',
                        c.nao_lido > 0 ? 'text-emerald-600 font-semibold' : 'text-muted-foreground',
                      )}>{formatContatoTime(c.ultima_mensagem_em)}</span>
                      {c.nao_lido > 0 && (
                        <span
                          className="inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-full bg-emerald-500 text-[11px] font-bold leading-none text-white shadow-md ring-2 ring-background"
                          aria-label={`${c.nao_lido} mensagem${c.nao_lido > 1 ? 's' : ''} não lida${c.nao_lido > 1 ? 's' : ''}`}
                        >
                          {c.nao_lido > 99 ? '99+' : c.nao_lido}
                        </span>
                      )}
                    </div>
                    {ets.length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-0.5">
                        {ets.map(et => (
                          <span key={et.id} className="text-[9px] px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: et.cor }}>{et.nome}</span>
                        ))}
                      </div>
                    )}
                    <div className="text-[10px] text-emerald-500/80 truncate">{inst?.nome || inst?.display_phone || ''}</div>
                  </button>
                </MetaConversaContextMenu>
              );
            })}
            </div>
          </ScrollArea>
        </div>

        {/* Painel da conversa */}
        <div className="flex-1 flex flex-col bg-background min-w-0"
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault(); setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) enviarMidia(f);
          }}>
          {!contatoAtivo ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Selecione uma conversa para começar
            </div>
          ) : (
            <>
              <div className="p-3 border-b flex items-center justify-between bg-card">
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate flex items-center gap-2">
                    {contatoAtivo.nome || (contatoAtivo.telefone ? formatTelefone(contatoAtivo.telefone) : (contatoAtivo.whatsapp_username ? `@${contatoAtivo.whatsapp_username}` : 'Contato sem telefone'))}
                    {contatoAtivo.whatsapp_username && (
                      <Badge variant="secondary" className="text-[10px] py-0 h-4">@{contatoAtivo.whatsapp_username}</Badge>
                    )}
                    {!contatoAtivo.telefone && contatoAtivo.bsuid && (
                      <Badge variant="outline" className="text-[10px] py-0 h-4" title={contatoAtivo.bsuid}>BSUID</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {contatoAtivo.telefone ? formatTelefone(contatoAtivo.telefone) : (contatoAtivo.bsuid || '—')} · via {instAtiva?.nome || instAtiva?.display_phone || 'Meta'}
                  </div>
                </div>

                {janelaInfo.aberta ? (
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-500 gap-1">
                    <Clock className="h-3 w-3" /> {formatDistanceToNowStrict(new Date(janelaInfo.expiraEm!), { locale: ptBR })}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-amber-500/40 text-amber-500 gap-1">
                    <AlertCircle className="h-3 w-3" /> 24h expiradas
                  </Badge>
                )}
              </div>

              <MetaInstanceHealthBanner instancia={instAtiva} />



              <div ref={chatContainerRef} className={cn('flex-1 overflow-y-auto p-3 relative', dragOver && 'bg-primary/10')}>
                {carregandoAnteriores && (
                  <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                )}
                {carregandoMsgs ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : (
                  <div className="space-y-2">
                    {mensagens.map((m, idx) => {
                      const prev = idx > 0 ? mensagens[idx - 1] : null;
                      const dStr = new Date(m.timestamp_msg).toLocaleDateString('pt-BR');
                      const prevStr = prev ? new Date(prev.timestamp_msg).toLocaleDateString('pt-BR') : null;
                      const sep = !prev || dStr !== prevStr;
                      return (
                        <div key={m.id}>
                          {sep && (
                            <div className="flex justify-center my-3">
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{dStr}</span>
                            </div>
                          )}
                          <div onDoubleClick={() => setRespondendo(m)} title="Duplo clique para responder">
                            <ChatMessage
                              msg={{
                                id: m.id, conteudo: m.conteudo, direcao: m.direcao,
                                timestamp_msg: m.timestamp_msg, tipo_conteudo: m.tipo_conteudo,
                                media_url: m.media_url, whatsapp_msg_id: m.wa_message_id,
                                status_envio: m.status_envio,
                                conteudo_citado: m.conteudo_citado,
                              } as any}
                              formatMsgTime={formatMsgTime}
                            />
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
                {dragOver && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="bg-primary/20 border-2 border-dashed border-primary rounded-lg px-6 py-4 text-sm font-medium">
                      Solte para enviar
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t bg-card">
                {!janelaInfo.aberta && (
                  <div className="m-3 text-xs bg-amber-500/10 border border-amber-500/30 rounded p-2 text-amber-700 dark:text-amber-400">
                    <strong>Janela 24h expirada.</strong> Use template HSM em <strong>Envio Meta (massa)</strong> para reabrir.
                  </div>
                )}
                {respondendo && (
                  <div className="px-3 pt-2 flex items-center gap-2">
                    <div className="flex-1 flex gap-2 rounded-md bg-muted/60 border-l-4 border-primary px-3 py-2 overflow-hidden">
                      <Reply className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium text-primary leading-tight">
                          Respondendo a {respondendo.direcao === 'saida' ? 'você' : 'esta mensagem'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate leading-tight">{respondendo.conteudo || 'Mídia'}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setRespondendo(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                {msgRapidas.length > 0 && janelaInfo.aberta && (
                  <div className="px-3 pt-2 flex gap-1.5 overflow-x-auto scrollbar-none">
                    {msgRapidas.map(m => (
                      <Button key={m.id} variant="outline" size="sm" className="shrink-0 text-xs h-7 px-2.5"
                        disabled={enviando || enviandoArquivo}
                        onClick={() => m.conteudo && enviar(m.conteudo)}>
                        {m.titulo}
                      </Button>
                    ))}
                  </div>
                )}
                {(audioRec.gravando || audioRec.transcrevendo) ? (
                  <div className="p-3 flex items-center gap-2">
                    <Button variant="ghost" size="icon"
                      onClick={audioRec.cancelarGravacao}
                      disabled={audioRec.enviandoAudio || audioRec.transcrevendo}>
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                    <div className="flex-1 flex items-center gap-2">
                      {audioRec.transcrevendo ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          <span className="text-sm text-primary font-medium">Transcrevendo áudio...</span>
                        </>
                      ) : (
                        <>
                          <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                          <span className="text-sm text-destructive font-medium">
                            {modoGravacao === 'transcrito' ? 'Gravando para transcrever' : 'Gravando áudio'} {audioRec.formatTempo(audioRec.tempoGravacao)}
                          </span>
                        </>
                      )}
                    </div>
                    <Button size="icon" onClick={finalizarGravacao}
                      disabled={audioRec.enviandoAudio || audioRec.transcrevendo}>
                      {audioRec.enviandoAudio ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                ) : (
                  <div className="p-3 flex gap-2 items-end">
                    <input ref={fileInputRef} type="file" className="hidden"
                      accept="image/*,audio/*,video/*,.pdf"
                      onChange={(e) => {
                        const f = e.target.files?.[0]; e.target.value = '';
                        if (f) enviarMidia(f);
                      }} />
                    <Button variant="ghost" size="icon" className="shrink-0"
                      disabled={!janelaInfo.aberta || enviando || enviandoArquivo}
                      onClick={() => fileInputRef.current?.click()}>
                      {enviandoArquivo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="shrink-0"
                          disabled={!janelaInfo.aberta || enviando || enviandoArquivo}
                          title="Gravar áudio">
                          <Mic className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" side="top" className="w-56">
                        <DropdownMenuItem onClick={() => iniciarGravacaoModo('audio')}>
                          <AudioLines className="h-4 w-4 mr-2" />
                          Enviar áudio
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => iniciarGravacaoModo('transcrito')}>
                          <FileText className="h-4 w-4 mr-2" />
                          Enviar áudio transcrito
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <MetaComposer
                      ref={composerRef}
                      disabled={!janelaInfo.aberta || enviando}
                      enviando={enviando}
                      placeholder={janelaInfo.aberta ? 'Digite uma mensagem...' : 'Janela 24h expirada — use template HSM'}
                      onSend={(t) => enviar(t)}
                      onPaste={onPaste}
                      onEscape={() => respondendo && setRespondendo(null)}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      </div>

      <MetaEtiquetasDialog open={etiquetasOpen} onOpenChange={setEtiquetasOpen} etiquetas={etiquetas} onChange={fetchEtiquetas} />
      <MetaMensagensRapidasDialog open={msgRapidasOpen} onOpenChange={setMsgRapidasOpen} onChange={fetchMsgRapidas} />
    </AppLayout>
  );
}
