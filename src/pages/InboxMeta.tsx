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
  Mic, AudioLines, FileText, Zap, Sun, Moon, Plus, Pencil, Users, Settings2,
  Bot, Download, ChevronUp,
} from 'lucide-react';

const CORES_ETIQUETA = ['#25D366', '#FF6B6B', '#4ECDC4', '#FFD93D', '#6C5CE7', '#FF8A5C', '#EA4C89', '#00B4D8'];
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChatMessage } from '@/components/inbox/ChatMessage';
import { MetaConversaContextMenu } from '@/components/inbox/meta/MetaConversaContextMenu';
import { MetaEtiquetasDialog, MetaEtiqueta } from '@/components/inbox/meta/MetaEtiquetasDialog';
import { MetaMensagensRapidasDialog, MetaMsgRapida } from '@/components/inbox/meta/MetaMensagensRapidasDialog';
import { MetaNovaConversaDialog } from '@/components/inbox/meta/MetaNovaConversaDialog';
import { ReabrirComTemplateDialog } from '@/components/inbox/meta/ReabrirComTemplateDialog';
import { NotificacoesCpfBell } from '@/components/inbox/meta/NotificacoesCpfBell';
import { ConfirmarEnvioArquivoDialog } from '@/components/inbox/meta/ConfirmarEnvioArquivoDialog';
import { MetaFoldersDialog, type MetaInboxFolder } from '@/components/inbox/meta/MetaFoldersDialog';
import { MetaFolderAcessoDialog } from '@/components/inbox/meta/MetaFolderAcessoDialog';
import MetaIAConfigDialog from '@/components/inbox/meta/MetaIAConfigDialog';
import { MetaQualificacaoDialog, type MetaQualificacao } from '@/components/inbox/meta/MetaQualificacaoDialog';
import { MetaFolderConfigDialog, CAIXA_PADRAO_ID } from '@/components/inbox/meta/MetaFolderConfigDialog';
import { CopyButton } from '@/components/CopyButton';

import { useUserRole } from '@/hooks/useUserRole';
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger,
} from '@/components/ui/context-menu';


import { MetaComposer, type MetaComposerHandle } from '@/components/inbox/meta/MetaComposer';
import { useMetaAudioRecorder } from '@/hooks/useMetaAudioRecorder';
import { MetaInstanceHealthBanner } from '@/components/inbox/meta/MetaInstanceHealthBanner';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { uploadInboxMedia } from '@/lib/inboxMediaUrl';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';

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
  folder_id?: string | null;
}
interface MetaMensagem {
  id: string; instancia_id: string; telefone: string; conteudo: string;
  direcao: string; timestamp_msg: string; tipo_conteudo?: string;
  media_url?: string | null; wa_message_id?: string | null; status_envio?: string | null;
  wa_message_id_reply?: string | null; conteudo_citado?: string | null;
  contatos_payload?: any[] | null;
  template_botoes?: any[] | null;
}

const PAGE_SIZE = 40;
const JANELA_24H_MS = 24 * 60 * 60 * 1000;
const ALERTA_1H_MS = 60 * 60 * 1000;

function formatTelefone(t: string) {
  const d = t.replace(/\D/g, '');
  if (d.length >= 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9, 13)}`;
  if (d.length >= 12) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  return t;
}
function telefoneSemDDI(t: string) {
  return t.replace(/\D/g, '').replace(/^55/, '');
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
  const { isAdmin } = useUserRole();
  const { toast } = useToast();

  const [instancias, setInstancias] = useState<MetaInstance[]>([]);
  const [filtroInstancia, setFiltroInstancia] = useState<string>('todas');
  const [contatos, setContatos] = useState<MetaContato[]>([]);
  const [contatoAtivo, setContatoAtivo] = useState<MetaContato | null>(null);
  const [mensagens, setMensagens] = useState<MetaMensagem[]>([]);
  const [busca, setBusca] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');

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
  const [filtroJanela24h, setFiltroJanela24h] = useState(false);
  // Caixas de mensagens (folders) — null representa a caixa padrão (folder_id IS NULL)
  const [folders, setFolders] = useState<MetaInboxFolder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [foldersDialogOpen, setFoldersDialogOpen] = useState(false);
  const [acessoFolder, setAcessoFolder] = useState<{ id: string | null; nome: string } | null>(null);
  const [iaConfigOpen, setIaConfigOpen] = useState(false);
  const [configFolder, setConfigFolder] = useState<{ id: string | null; nome: string } | null>(null);
  // Qualificação de conversas
  const [qualificacoes, setQualificacoes] = useState<MetaQualificacao[]>([]);
  const [qualifPorContato, setQualifPorContato] = useState<Record<string, string[]>>({});
  const [qualifCaixas, setQualifCaixas] = useState<Record<string, boolean>>({});
  const [qualifDialogOpen, setQualifDialogOpen] = useState(false);
  // Meus Clientes (conversas com a etiqueta do próprio usuário)
  const [modoMeusClientes, setModoMeusClientes] = useState(false);
  const [mcDataIni, setMcDataIni] = useState<Date | undefined>(undefined);
  const [mcDataFim, setMcDataFim] = useState<Date | undefined>(undefined);
  const [mcMarcadores, setMcMarcadores] = useState<Set<string>>(new Set());
  const [minhaEtiquetaId, setMinhaEtiquetaId] = useState<string | null>(null);
  const [mcMarcadoresOpen, setMcMarcadoresOpen] = useState(false);
  const [mcExportando, setMcExportando] = useState(false);
  // Minimizar/maximizar os filtros da lista
  const [filtrosRecolhidos, setFiltrosRecolhidos] = useState<boolean>(() => {
    try { return localStorage.getItem('inbox-meta-filtros-recolhidos') === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('inbox-meta-filtros-recolhidos', filtrosRecolhidos ? '1' : '0'); } catch { /* noop */ }
  }, [filtrosRecolhidos]);



  const [podeVerPadrao, setPodeVerPadrao] = useState(true);
  const [nomesCRM, setNomesCRM] = useState<Record<string, string>>({}); // suffix8 -> nome do devedor

  
  const [etiquetasOpen, setEtiquetasOpen] = useState(false);
  const [etiquetasConfigOpen, setEtiquetasConfigOpen] = useState(false);
  const [editEtId, setEditEtId] = useState<string | null>(null);
  const [editEtCor, setEditEtCor] = useState<string>(CORES_ETIQUETA[0]);
  const [msgRapidasOpen, setMsgRapidasOpen] = useState(false);
  const [novaConversaOpen, setNovaConversaOpen] = useState(false);
  const [reabrirTemplateOpen, setReabrirTemplateOpen] = useState(false);
  const [msgRapidas, setMsgRapidas] = useState<MetaMsgRapida[]>([]);

  const [selMultipla, setSelMultipla] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [respondendo, setRespondendo] = useState<MetaMensagem | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [arquivoParaConfirmar, setArquivoParaConfirmar] = useState<File | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<MetaComposerHandle>(null);
  const [modoGravacao, setModoGravacao] = useState<'audio' | 'transcrito'>('audio');
  const [atendenteNome, setAtendenteNome] = useState<string>('');
  const [pendingTranscricao, setPendingTranscricao] = useState<string>('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('profiles').select('nome').eq('id', user.id).maybeSingle();
      const nome = (data?.nome || '').trim();
      if (!nome) return;
      const APELIDOS: { match: RegExp; nome: string }[] = [
        { match: /^anna\s*fl[aá]via/i, nome: 'Anna Flavia' },
        { match: /^fernanda/i, nome: 'Fernanda' },
        { match: /^wallace/i, nome: 'Wallace' },
        { match: /^yasmi?n/i, nome: 'Yasmim' },
      ];
      const match = APELIDOS.find(a => a.match.test(nome));
      setAtendenteNome(match ? match.nome : nome.split(' ')[0]);
    })();
  }, [user]);


  const formatarMensagemAtendente = useCallback((t: string): string => {
    if (!atendenteNome) return t;
    if (/^\*Atendente\s/i.test(t)) return t;
    return `*Atendente ${atendenteNome}:*\n\n${t}`;
  }, [atendenteNome]);
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
      const { data } = await (supabase as any).rpc('get_meta_whatsapp_active_instances_for_sending');
      setInstancias((data as MetaInstance[]) ?? []);
    })();
  }, [user]);

  const fetchEtiquetas = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('meta_whatsapp_etiquetas')
      .select('id, nome, cor, ativa').order('nome');
    setEtiquetas(((data as any[]) ?? []).map((e) => ({ ...e, ativa: e.ativa !== false })) as MetaEtiqueta[]);
  }, [user]);

  const [etiquetasBloqueadas, setEtiquetasBloqueadas] = useState<Record<string, Set<string>>>({});
  // Busca vínculos de etiqueta SOMENTE dos contatos exibidos na tela.
  // Antes fazia varredura completa da tabela em cada carregamento/foco.
  const fetchContatoEtiquetas = useCallback(async (contatoIds?: string[]) => {
    const ids = (contatoIds ?? []).filter(Boolean);
    if (ids.length === 0) return;
    const CHUNK = 200;
    const all: Array<{ contato_id: string; etiqueta_id: string; origem: string | null }> = [];
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      const { data, error } = await supabase
        .from('meta_whatsapp_contato_etiquetas')
        .select('contato_id, etiqueta_id, origem')
        .in('contato_id', slice);
      if (error) return; // preserva state anterior em caso de erro
      all.push(...((data as any[]) ?? []));
    }
    const map: Record<string, string[]> = {};
    const bloq: Record<string, Set<string>> = {};
    all.forEach((r) => {
      if (!map[r.contato_id]) map[r.contato_id] = [];
      map[r.contato_id].push(r.etiqueta_id);
      if (r.origem === 'auto_atendente') {
        if (!bloq[r.contato_id]) bloq[r.contato_id] = new Set();
        bloq[r.contato_id].add(r.etiqueta_id);
      }
    });
    setContatoEtiquetas(prev => ({ ...prev, ...map }));
    setEtiquetasBloqueadas(prev => {
      const next = { ...prev };
      for (const id of ids) delete next[id];
      return { ...next, ...bloq };
    });
  }, []);


  // Aplica evento realtime incrementalmente para não zerar o state a cada mudança
  const applyEtiquetaEvent = useCallback((payload: any) => {
    const evt = payload?.eventType;
    const row = payload?.new ?? payload?.old;
    if (!row?.contato_id || !row?.etiqueta_id) return;
    const cid: string = row.contato_id;
    const eid: string = row.etiqueta_id;
    const origem: string | null = payload?.new?.origem ?? null;

    if (evt === 'INSERT') {
      setContatoEtiquetas(prev => {
        const arr = prev[cid] ? [...prev[cid]] : [];
        if (!arr.includes(eid)) arr.push(eid);
        return { ...prev, [cid]: arr };
      });
      if (origem === 'auto_atendente') {
        setEtiquetasBloqueadas(prev => {
          const s = new Set(prev[cid] ?? []);
          s.add(eid);
          return { ...prev, [cid]: s };
        });
      }
    } else if (evt === 'DELETE') {
      setContatoEtiquetas(prev => {
        if (!prev[cid]) return prev;
        return { ...prev, [cid]: prev[cid].filter(x => x !== eid) };
      });
      setEtiquetasBloqueadas(prev => {
        if (!prev[cid]) return prev;
        const s = new Set(prev[cid]);
        s.delete(eid);
        return { ...prev, [cid]: s };
      });
    } else if (evt === 'UPDATE') {
      setEtiquetasBloqueadas(prev => {
        const s = new Set(prev[cid] ?? []);
        if (origem === 'auto_atendente') s.add(eid);
        else s.delete(eid);
        return { ...prev, [cid]: s };
      });
    }
  }, []);

  const fetchMsgRapidas = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('meta_whatsapp_mensagens_rapidas')
      .select('id, titulo, tipo, conteudo, audio_url').eq('user_id', user.id).order('ordem');
    setMsgRapidas((data as MetaMsgRapida[]) ?? []);
  }, [user]);

  useEffect(() => { fetchEtiquetas(); fetchMsgRapidas(); }, [fetchEtiquetas, fetchMsgRapidas]);

  const fetchFolders = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('meta_inbox_folders')
      .select('id, nome, cor, owner_id')
      .order('nome');
    setFolders(((data as any) ?? []) as MetaInboxFolder[]);
    // Caixa Padrão: visível só para admin ou usuários atribuídos a ela.
    if (isAdmin) {
      setPodeVerPadrao(true);
    } else {
      const { data: dm } = await (supabase as any)
        .from('meta_inbox_default_members')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();
      setPodeVerPadrao(!!dm);
    }
  }, [user, isAdmin]);

  useEffect(() => { fetchFolders(); }, [fetchFolders]);

  const fetchQualificacoes = useCallback(async () => {
    const { data } = await (supabase as any).from('meta_qualificacoes')
      .select('id, nome, cor, ordem, ativo').order('ordem');
    setQualificacoes(((data as any) ?? []) as MetaQualificacao[]);
    const { data: cx } = await (supabase as any).from('meta_qualificacao_caixa')
      .select('folder_id, ativo');
    const map: Record<string, boolean> = {};
    ((cx as any[]) ?? []).forEach(r => { map[r.folder_id] = !!r.ativo; });
    setQualifCaixas(map);
  }, []);

  useEffect(() => { fetchQualificacoes(); }, [fetchQualificacoes]);

  const fetchQualifContatos = useCallback(async (ids: string[]) => {
    if (!ids.length) { setQualifPorContato({}); return; }
    const map: Record<string, string[]> = {};
    for (let i = 0; i < ids.length; i += 300) {
      const { data } = await (supabase as any).from('meta_contato_qualificacao')
        .select('contato_id, qualificacao_id').in('contato_id', ids.slice(i, i + 300));
      ((data as any[]) ?? []).forEach(r => {
        if (!map[r.contato_id]) map[r.contato_id] = [];
        if (r.qualificacao_id) map[r.contato_id].push(r.qualificacao_id);
      });
    }
    setQualifPorContato(map);
  }, []);

  const qualificacaoAtivaNaCaixa = qualifCaixas[currentFolderId ?? CAIXA_PADRAO_ID] ?? true;

  // Somente caixas permitidas (RLS já filtra a lista de folders)
  const foldersVisiveis = folders;

  // Se a caixa ativa não é permitida, cai na primeira permitida.
  useEffect(() => {
    if (currentFolderId === null) {
      if (!podeVerPadrao && foldersVisiveis.length > 0) setCurrentFolderId(foldersVisiveis[0].id);
      return;
    }
    if (!foldersVisiveis.some((f) => f.id === currentFolderId)) {
      setCurrentFolderId(podeVerPadrao ? null : (foldersVisiveis[0]?.id ?? null));
    }
  }, [podeVerPadrao, foldersVisiveis, currentFolderId]);

  // Atendentes responsáveis pela caixa ativa: nomes permitidos para etiqueta
  const [nomesAtendenteCaixa, setNomesAtendenteCaixa] = useState<Set<string> | null>(null);
  useEffect(() => {
    let cancelado = false;
    (async () => {
      if (!user) return;
      const q = currentFolderId
        ? (supabase as any).from('meta_inbox_folder_members').select('user_id').eq('folder_id', currentFolderId)
        : (supabase as any).from('meta_inbox_default_members').select('user_id');
      const { data: mem } = await q;
      const ids = ((mem as any[]) ?? []).map((m) => m.user_id);
      if (cancelado) return;
      if (ids.length === 0) { setNomesAtendenteCaixa(null); return; }
      const { data: profs } = await supabase.from('profiles').select('id, nome').in('id', ids);
      if (cancelado) return;
      const nomes = new Set<string>(
        ((profs as any[]) ?? [])
          .map((p) => String(p.nome || '').trim().toLowerCase())
          .filter(Boolean)
      );
      setNomesAtendenteCaixa(nomes.size > 0 ? nomes : null);
    })();
    return () => { cancelado = true; };
  }, [user, currentFolderId]);

  // Etiquetas ativas (desativadas ficam invisíveis nos menus/filtros)
  const etiquetasAtivas = useMemo(() => etiquetas.filter(e => e.ativa !== false), [etiquetas]);

  // Etiquetas oferecidas no menu de contexto: atendentes só da caixa ativa
  const etiquetasMenu = useMemo(() => {
    if (!nomesAtendenteCaixa) return etiquetasAtivas;
    return etiquetasAtivas.filter((e) => {
      const nome = String(e.nome || '').trim();
      if (!/^atendente:/i.test(nome)) return true;
      const puro = nome.replace(/^atendente:\s*/i, '').trim().toLowerCase();
      return nomesAtendenteCaixa.has(puro);
    });
  }, [etiquetasAtivas, nomesAtendenteCaixa]);

  // Etiqueta "Atendente: <meu nome>" do usuário logado (para "Meus Clientes")
  useEffect(() => {
    if (!user || etiquetas.length === 0) return;
    let cancelado = false;
    (async () => {
      const { data } = await supabase.from('profiles').select('nome').eq('id', user.id).maybeSingle();
      if (cancelado) return;
      const meuNome = norm(String((data as any)?.nome || '').trim());
      if (!meuNome) { setMinhaEtiquetaId(null); return; }
      const apelido = norm(atendenteNome);
      const cand = etiquetas.find((e) => {
        const nome = String(e.nome || '').trim();
        if (!/^atendente:/i.test(nome)) return false;
        const puro = norm(nome.replace(/^atendente:\s*/i, '').trim());
        if (!puro) return false;
        return puro === meuNome || meuNome.startsWith(puro) || puro.startsWith(meuNome) ||
          (!!apelido && (puro === apelido || puro.startsWith(apelido)));
      });
      setMinhaEtiquetaId(cand?.id ?? null);
    })();
    return () => { cancelado = true; };
  }, [user, etiquetas, atendenteNome]);


  // Paginação da lista de conversas: lote inicial leve + "carregar mais"
  const PAGE_CONTATOS = 300;
  const contatoIdsRef = useRef<string[]>([]);
  const [limiteContatos, setLimiteContatos] = useState(PAGE_CONTATOS);

  const [carregandoMais, setCarregandoMais] = useState(false);

  // Troca de caixa/instância/aba/busca volta ao primeiro lote
  useEffect(() => { setLimiteContatos(PAGE_CONTATOS); }, [filtroInstancia, abaAtiva, buscaDebounced, currentFolderId, modoMeusClientes, mcDataIni, mcDataFim]);

  const fetchContatos = useCallback(async () => {
    if (!user) return;
    const selectCols = 'id, instancia_id, telefone, nome, ultima_mensagem, ultima_mensagem_em, ultima_msg_entrada_em, nao_lido, fixado, arquivado, folder_id';

    // ===== Modo "Meus Clientes": todo o histórico com a etiqueta do usuário =====
    if (modoMeusClientes) {
      if (!minhaEtiquetaId) {
        setContatos([]);
        contatoIdsRef.current = [];
        return;
      }
      const vinculos: string[] = [];
      const PAG = 1000;
      for (let p = 0; p < 20; p++) {
        const { data: vs } = await supabase
          .from('meta_whatsapp_contato_etiquetas')
          .select('contato_id')
          .eq('etiqueta_id', minhaEtiquetaId)
          .range(p * PAG, p * PAG + PAG - 1);
        const arr = ((vs as any[]) ?? []).map(v => v.contato_id).filter(Boolean);
        vinculos.push(...arr);
        if (arr.length < PAG) break;
      }
      const ids = Array.from(new Set(vinculos));
      if (ids.length === 0) {
        setContatos([]);
        contatoIdsRef.current = [];
        return;
      }
      const iniIso = mcDataIni ? new Date(new Date(mcDataIni).setHours(0, 0, 0, 0)).toISOString() : null;
      const fimIso = mcDataFim ? new Date(new Date(mcDataFim).setHours(23, 59, 59, 999)).toISOString() : null;
      const acumulado: MetaContato[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        let qc = supabase.from('meta_whatsapp_contatos')
          .select(selectCols)
          .in('id', ids.slice(i, i + 200))
          .order('ultima_mensagem_em', { ascending: false, nullsFirst: false });
        if (filtroInstancia !== 'todas') qc = qc.eq('instancia_id', filtroInstancia);
        if (iniIso) qc = qc.gte('ultima_mensagem_em', iniIso);
        if (fimIso) qc = qc.lte('ultima_mensagem_em', fimIso);
        const { data: parte } = await qc;
        acumulado.push(...((parte as MetaContato[]) ?? []));
      }
      acumulado.sort((a, b) => {
        const ta = a.ultima_mensagem_em ? new Date(a.ultima_mensagem_em).getTime() : 0;
        const tb = b.ultima_mensagem_em ? new Date(b.ultima_mensagem_em).getTime() : 0;
        return tb - ta;
      });
      const lista = acumulado.slice(0, limiteContatos);
      setContatos(lista);
      contatoIdsRef.current = lista.map(c => c.id);
      fetchContatoEtiquetas(contatoIdsRef.current);
      fetchQualifContatos(contatoIdsRef.current);
      return;
    }

    // Lista base paginada (usa idx_meta_wa_contatos_arq_ult).
    let q = supabase.from('meta_whatsapp_contatos')
      .select(selectCols)
      .eq('arquivado', abaAtiva === 'arquivados')
      .order('ultima_mensagem_em', { ascending: false, nullsFirst: false })
      .limit(limiteContatos);

    if (filtroInstancia !== 'todas') q = q.eq('instancia_id', filtroInstancia);
    if (currentFolderId === null) q = q.is('folder_id', null);
    else q = q.eq('folder_id', currentFolderId);
    const { data: base } = await q;
    let combinados: MetaContato[] = (base as MetaContato[]) ?? [];

    // Busca server-side: se usuário digitou algo, procura no banco inteiro
    // e mescla com a lista base para nunca "sumir" conversas antigas.
    const bRaw = buscaDebounced.trim();

    if (bRaw) {
      const bDigits = bRaw.replace(/\D/g, '');
      const orParts: string[] = [];
      // ilike com escape básico de vírgulas e parênteses
      const safeText = bRaw.replace(/[,()%]/g, ' ').trim();
      if (safeText) orParts.push(`nome.ilike.%${safeText}%`);
      if (bDigits) {
        orParts.push(`telefone.ilike.%${bDigits}%`);
        // Também casa pelo sufixo (últimos 8 dígitos) — tolera o "9" extra do celular
        if (bDigits.length >= 8) orParts.push(`telefone.ilike.%${bDigits.slice(-8)}`);
      }
      if (orParts.length) {
        let qs = supabase.from('meta_whatsapp_contatos')
          .select(selectCols)
          .eq('arquivado', abaAtiva === 'arquivados')
          .or(orParts.join(','))
          .order('ultima_mensagem_em', { ascending: false, nullsFirst: false })
          .limit(200);
        if (filtroInstancia !== 'todas') qs = qs.eq('instancia_id', filtroInstancia);
        if (currentFolderId === null) qs = qs.is('folder_id', null);
        else qs = qs.eq('folder_id', currentFolderId);
        const { data: extras } = await qs;
        if (extras?.length) {
          const seen = new Set(combinados.map(c => c.id));
          for (const e of extras as MetaContato[]) {
            if (!seen.has(e.id)) { combinados.push(e); seen.add(e.id); }
          }
        }
      }
    }

    setContatos(combinados);
    contatoIdsRef.current = combinados.map(c => c.id);
    // Etiquetas apenas dos contatos que entraram na lista
    fetchContatoEtiquetas(contatoIdsRef.current);
    fetchQualifContatos(contatoIdsRef.current);
  }, [user, filtroInstancia, abaAtiva, buscaDebounced, currentFolderId, limiteContatos, fetchContatoEtiquetas, fetchQualifContatos, modoMeusClientes, minhaEtiquetaId, mcDataIni, mcDataFim]);

  // Debounce da busca — evita bater no banco a cada tecla
  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca), 250);
    return () => clearTimeout(t);
  }, [busca]);

  useEffect(() => {
    let ativo = true;
    (async () => {
      if (limiteContatos > PAGE_CONTATOS) setCarregandoMais(true);
      await fetchContatos();
      if (ativo) setCarregandoMais(false);
    })();
    return () => { ativo = false; };
  }, [fetchContatos]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime (agrupado) — sem polling periódico
  useEffect(() => {
    if (!user) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const agendarRefetch = () => {
      if (timer) return; // agrupa rajadas de eventos em uma única leitura
      timer = setTimeout(() => { timer = null; fetchContatos(); }, 1500);
    };
    const contatosFilter = currentFolderId ? { filter: `folder_id=eq.${currentFolderId}` } : {};
    const channel = supabase
      .channel('meta-inbox-contatos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meta_whatsapp_contatos', ...contatosFilter }, () => {
        agendarRefetch();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meta_whatsapp_contato_etiquetas' }, (payload) => {
        applyEtiquetaEvent(payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meta_whatsapp_etiquetas' }, () => {
        fetchEtiquetas();
      })
      .subscribe();
    const onVis = () => {
      if (!document.hidden) {
        fetchContatos();
        // Reconcilia etiquetas dos contatos visíveis caso algum evento tenha sido perdido
        fetchContatoEtiquetas(contatoIdsRef.current);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [user, currentFolderId, fetchContatos, fetchContatoEtiquetas, fetchEtiquetas, applyEtiquetaEvent]);


  // ============== Mensagens ==============
  // Cache em memória das mensagens por conversa (abertura instantânea ao reabrir)
  const msgCacheRef = useRef<Map<string, MetaMensagem[]>>(new Map());

  const fetchMensagens = useCallback(async (contato: MetaContato, loadMore = false) => {
    const cached = msgCacheRef.current.get(contato.id);
    if (loadMore) setCarregandoAnteriores(true);
    else if (!cached?.length) setCarregandoMsgs(true);
    const offset = loadMore ? (paginaAtual + 1) * PAGE_SIZE : 0;
    // Casa pelo sufixo de 8 dígitos para unificar variações com/sem "9" do celular
    const telDigits = String(contato.telefone || '').replace(/\D/g, '');
    const telSuffix = telDigits.length >= 8 ? telDigits.slice(-8) : telDigits;
    const { data } = await supabase.rpc('meta_mensagens_thread', {
      _instancia: contato.instancia_id,
      _suffix: telSuffix,
      _limit: PAGE_SIZE,
      _offset: offset,
    });
    const pagina = ((data as MetaMensagem[]) ?? []);
    const lista = [...pagina].reverse();
    if (loadMore) {
      const container = chatContainerRef.current;
      const oldH = container?.scrollHeight || 0;
      setMensagens(prev => {
        const ids = new Set(prev.map(m => m.id));
        const merged = [...lista.filter(m => !ids.has(m.id)), ...prev];
        msgCacheRef.current.set(contato.id, merged);
        return merged;
      });
      setPaginaAtual(p => p + 1);
      setTemMaisAnteriores(pagina.length === PAGE_SIZE);
      requestAnimationFrame(() => {
        if (container) container.scrollTop = container.scrollHeight - oldH;
      });
      setCarregandoAnteriores(false);
    } else {
      msgCacheRef.current.set(contato.id, lista);
      setMensagens(lista);
      setPaginaAtual(0);
      setTemMaisAnteriores(pagina.length === PAGE_SIZE);
      setCarregandoMsgs(false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 50);
      if (contato.nao_lido > 0) {
        setContatos(prev => prev.map(c => c.id === contato.id ? { ...c, nao_lido: 0 } : c));
        await supabase.from('meta_whatsapp_contatos').update({ nao_lido: 0 }).eq('id', contato.id);
      }
    }
  }, [paginaAtual]);

  useEffect(() => {
    if (contatoAtivo) {
      // Hidrata na hora com o cache (se houver) e revalida em background
      const cached = msgCacheRef.current.get(contatoAtivo.id);
      if (cached?.length) {
        setMensagens(cached);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 0);
      } else {
        setMensagens([]);
      }
      fetchMensagens(contatoAtivo, false);
    } else setMensagens([]);
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

  // Mantém o cache em dia com o estado atual da conversa aberta
  useEffect(() => {
    if (contatoAtivo && mensagens.length) msgCacheRef.current.set(contatoAtivo.id, mensagens);
  }, [mensagens, contatoAtivo?.id]);

  // Realtime mensagens
  useEffect(() => {
    if (!contatoAtivo) return;
    const channel = supabase
      .channel(`meta-msgs-${contatoAtivo.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'meta_whatsapp_mensagens', filter: `instancia_id=eq.${contatoAtivo.instancia_id}` },
        (payload) => {
          const row = (payload.new || payload.old) as MetaMensagem;
          if (!row || row.instancia_id !== contatoAtivo.instancia_id) return;
          const rowDigits = String(row.telefone || '').replace(/\D/g, '');
          const atvDigits = String(contatoAtivo.telefone || '').replace(/\D/g, '');
          const rowSuf = rowDigits.length >= 8 ? rowDigits.slice(-8) : rowDigits;
          const atvSuf = atvDigits.length >= 8 ? atvDigits.slice(-8) : atvDigits;
          if (!rowSuf || !atvSuf || rowSuf !== atvSuf) return;
          if (payload.eventType === 'INSERT') {
            setMensagens(prev => prev.some(m => m.id === row.id) ? prev : [...prev, row]);
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 30);
          } else if (payload.eventType === 'UPDATE') {
            setMensagens(prev => prev.map(m => m.id === row.id ? { ...m, ...row } : m));
            // Feedback quando a Meta recusa uma mídia enviada por nós.
            if (row.direcao === 'saida' && row.status_envio === 'erro') {
              const errMsg = (row as any).erro as string | undefined;
              if (row.tipo_conteudo === 'audio') {
                toast({
                  title: 'WhatsApp recusou o áudio',
                  description: errMsg || 'Grave novamente — o formato foi rejeitado pelo WhatsApp.',
                  variant: 'destructive',
                });
              } else if (errMsg) {
                toast({ title: 'Falha no envio', description: errMsg, variant: 'destructive' });
              }
            }
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

  // Carrega nomes do CRM por telefone sem varrer a tabela grande de devedores.
  useEffect(() => {
    (async () => {
      const semNome = contatos.filter(c => !c.nome && c.telefone);
      if (semNome.length === 0) return;
      const suffixes = Array.from(new Set(semNome.map(c => suffix8(c.telefone)).filter(Boolean)));
      const faltando = suffixes.filter(s => !(s in nomesCRM));
      if (faltando.length === 0) return;
      const { data } = await (supabase as any)
        .rpc('buscar_nomes_crm_por_telefone_suffix', { p_suffixes: faltando.slice(0, 200) });
      if (!data) return;
      setNomesCRM(prev => {
        const next = { ...prev };
        for (const s of faltando) if (!(s in next)) next[s] = '';
        for (const row of data as any[]) {
          const sfx = suffix8(row.suffix || '');
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
        if (filtroJanela24h) {
          if (!c.ultima_msg_entrada_em) return false;
          const fim = new Date(c.ultima_msg_entrada_em).getTime() + JANELA_24H_MS;
          if (fim - Date.now() <= 0) return false;
        }
        if (modoMeusClientes && mcMarcadores.size > 0) {
          const qids = qualifPorContato[c.id] ?? [];
          if (!qids.some(id => mcMarcadores.has(id))) return false;
        }
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
  }, [contatos, busca, filtroEtiqueta, contatoEtiquetas, filtroLeitura, nomesCRM, filtroJanela24h, modoMeusClientes, mcMarcadores, qualifPorContato]);

  // Exportar "Meus Clientes" para Excel (telefones + marcadores)
  const baixarMeusClientesExcel = useCallback(async () => {
    if (contatosFiltrados.length === 0) {
      toast({ title: 'Nada para exportar', description: 'Nenhum cliente na lista atual.' });
      return;
    }
    setMcExportando(true);
    try {
      const { exportarParaExcel } = await import('@/lib/exportExcel');
      const nomeCaixa = (id?: string | null) => (id ? (folders.find(f => f.id === id)?.nome || '—') : 'Padrão');
      const linhas = contatosFiltrados.map(c => {
        const qs = (qualifPorContato[c.id] ?? [])
          .map(id => qualificacoes.find(x => x.id === id)?.nome)
          .filter(Boolean) as string[];
        return {
          telefone: formatTelefone(c.telefone || ''),
          nome: c.nome || nomesCRM[suffix8(c.telefone)] || '',
          marcador: qs.length ? qs.join(', ') : 'Não qualificado',
          ultima: c.ultima_mensagem_em ? format(new Date(c.ultima_mensagem_em), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '',
          caixa: nomeCaixa(c.folder_id),
        };
      });
      await exportarParaExcel(
        linhas,
        [
          { chave: 'telefone', titulo: 'Telefone' },
          { chave: 'nome', titulo: 'Nome' },
          { chave: 'marcador', titulo: 'Marcador' },
          { chave: 'ultima', titulo: 'Última mensagem em' },
          { chave: 'caixa', titulo: 'Caixa de mensagens' },
        ],
        `meus-clientes-${format(new Date(), 'yyyy-MM-dd')}`,
      );
      toast({ title: 'Excel gerado', description: `${linhas.length} cliente(s) exportado(s).` });
    } catch (e: any) {
      toast({ title: 'Erro ao exportar', description: e?.message || 'Falha ao gerar o Excel', variant: 'destructive' });
    } finally {
      setMcExportando(false);
    }
  }, [contatosFiltrados, qualificacoes, qualifPorContato, nomesCRM, folders, toast]);



  // Prefetch da conversa do topo da lista (caso mais comum)
  useEffect(() => {
    const primeiro = contatosFiltrados?.[0];
    if (!primeiro || contatoAtivo || msgCacheRef.current.has(primeiro.id)) return;
    const t = setTimeout(async () => {
      const telDigits = String(primeiro.telefone || '').replace(/\D/g, '');
      const telSuffix = telDigits.length >= 8 ? telDigits.slice(-8) : telDigits;
      const { data } = await supabase.rpc('meta_mensagens_thread', {
        _instancia: primeiro.instancia_id,
        _suffix: telSuffix,
        _limit: PAGE_SIZE,
        _offset: 0,
      });
      if (data) msgCacheRef.current.set(primeiro.id, ((data as any[]) as MetaMensagem[]).slice().reverse());
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contatosFiltrados?.[0]?.id, contatoAtivo?.id]);


  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const computeJanela = useCallback((ultimaEntradaIso?: string | null) => {
    if (!ultimaEntradaIso) return { status: 'fechada' as const, fim: 0, msRestante: 0 };
    const fim = new Date(ultimaEntradaIso).getTime() + JANELA_24H_MS;
    const msRestante = fim - nowTick;
    if (msRestante <= 0) return { status: 'fechada' as const, fim, msRestante: 0 };
    if (msRestante <= ALERTA_1H_MS) return { status: 'alerta' as const, fim, msRestante };
    return { status: 'aberta' as const, fim, msRestante };
  }, [nowTick]);

  const janelaInfo = useMemo(() => {
    const j = computeJanela(contatoAtivo?.ultima_msg_entrada_em);
    return {
      ...j,
      aberta: j.status !== 'fechada',
      expiraEm: j.fim ? new Date(j.fim).toISOString() : null,
    };
  }, [contatoAtivo, computeJanela]);

  const instAtiva = useMemo(() => instancias.find(i => i.id === contatoAtivo?.instancia_id), [instancias, contatoAtivo]);

  // ============== Envio ==============
  const enviar = async (textoCustom?: string) => {
    const raw = (textoCustom ?? '').trim();
    if (!contatoAtivo || !raw || enviando) return;
    if (!janelaInfo.aberta) {
      toast({ title: 'Janela 24h fechada', description: 'Envie um template UTILITY em Envio Meta para reabrir. Texto livre agora custaria como MARKETING.', variant: 'destructive' });
      return;
    }
    const t = formatarMensagemAtendente(raw);
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
        if (composerRef.current) {
          composerRef.current.appendText(texto);
        } else {
          setPendingTranscricao(texto);
        }
        toast({ title: 'Áudio transcrito', description: 'Revise o texto e clique em enviar.' });
      }
    } else {
      await audioRec.enviarGravacao();
    }
  };

  const enviarMidia = async (file: File, caption?: string) => {
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
      const path = `${contatoAtivo.instancia_id}/${contatoAtivo.telefone || contatoAtivo.bsuid}/${Date.now()}.${ext}`;
      const mediaSignedUrl = await uploadInboxMedia(path, file, file.type);
      const type = isImage ? 'image' : isAudio ? 'audio' : isVideo ? 'video' : 'document';
      const { data, error } = await supabase.functions.invoke('send-whatsapp-meta-media', {
        body: {
          instancia_id: contatoAtivo.instancia_id,
          telefone: contatoAtivo.telefone || undefined,
          bsuid: contatoAtivo.bsuid || undefined,
          media_url: mediaSignedUrl,
          type,
          file_name: file.name,
          caption: caption || undefined,
          user_id: user?.id,
          reply_to_wa_id: respondendo?.wa_message_id,
          conteudo_citado: respondendo?.conteudo,
        },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Falha');
      setRespondendo(null);
      setArquivoParaConfirmar(null);
    } catch (e: any) {
      toast({ title: 'Erro ao enviar mídia', description: e.message, variant: 'destructive' });
    } finally {
      setEnviandoArquivo(false);
    }
  };

  // Helper: valida tipo e abre confirmação em vez de enviar direto.
  const solicitarConfirmacaoArquivo = (file: File) => {
    if (!contatoAtivo) return;
    if (!janelaInfo.aberta) {
      toast({ title: 'Janela 24h expirada', variant: 'destructive' });
      return;
    }
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    const isAudio = file.type.startsWith('audio/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isPdf && !isAudio && !isVideo) {
      toast({ title: 'Arquivo inválido', description: 'Envie imagem, áudio, vídeo ou PDF', variant: 'destructive' });
      return;
    }
    setArquivoParaConfirmar(file);
  };


  const onPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items; if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const f = items[i].getAsFile();
        if (f) solicitarConfirmacaoArquivo(new File([f], `clipboard-${Date.now()}.png`, { type: f.type }));
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
          <div className={cn('border-b space-y-2', filtrosRecolhidos ? 'p-2' : 'p-3')}>
            <div className="flex justify-end">
              <button
                onClick={() => setFiltrosRecolhidos(v => !v)}
                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-accent"
                title={filtrosRecolhidos ? 'Mostrar filtros e caixas' : 'Minimizar filtros e caixas'}
              >
                {filtrosRecolhidos ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                {filtrosRecolhidos ? 'Mostrar filtros' : 'Minimizar filtros'}
              </button>
            </div>
            {!filtrosRecolhidos && (
            <>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <h2 className="text-sm font-semibold flex-1">Inbox API Oficial Meta</h2>
              <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-500">Oficial</Badge>
              <NotificacoesCpfBell />
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={toggleTema} title={tema === 'dark' ? 'Modo claro' : 'Modo escuro'}>
                {tema === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setNovaConversaOpen(true)} title="Nova conversa">
                <Plus className="h-4 w-4" />
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
                <PopoverContent className="w-64 p-1 overflow-hidden" align="end">
                  <button
                    onClick={() => { setFiltroEtiqueta(null); setFiltroEtOpen(false); }}
                    className={cn('w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent', !filtroEtiqueta && 'bg-accent')}>
                    Todas as conversas
                  </button>
                  <div
                    className="label-filter-scroll h-[min(420px,calc(100vh-10rem))] min-h-0 overflow-y-scroll overscroll-contain pr-1"
                    style={{ scrollbarWidth: 'auto', scrollbarColor: 'hsl(var(--muted-foreground)) hsl(var(--muted))' }}
                    onWheel={(event) => event.stopPropagation()}
                    onTouchMove={(event) => event.stopPropagation()}
                  >
                  {etiquetasAtivas.map(et => {
                    const emEdicao = editEtId === et.id;
                    if (emEdicao) {
                      return (
                        <div key={et.id} className="p-2 rounded bg-accent/50 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: editEtCor }} />
                            <span className="text-xs truncate flex-1">{et.nome}</span>
                          </div>
                          <div className="flex gap-1 flex-wrap">
                            {CORES_ETIQUETA.map(c => (
                              <button key={c} onClick={() => setEditEtCor(c)}
                                className="h-5 w-5 rounded-full border-2 transition-transform"
                                style={{ backgroundColor: c, borderColor: editEtCor === c ? 'hsl(var(--foreground))' : 'transparent', transform: editEtCor === c ? 'scale(1.15)' : 'scale(1)' }} />
                            ))}
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" className="h-6 flex-1 text-xs" onClick={async () => {
                              const { error } = await supabase.from('meta_whatsapp_etiquetas').update({ cor: editEtCor }).eq('id', et.id);
                              if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
                              setEditEtId(null); fetchEtiquetas();
                            }}>Salvar</Button>
                            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditEtId(null)}>Cancelar</Button>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={et.id}
                        className={cn('w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded hover:bg-accent group', filtroEtiqueta === et.id && 'bg-accent')}>
                        <button
                          onClick={() => { setFiltroEtiqueta(et.id); setFiltroEtOpen(false); }}
                          className="flex items-center gap-2 flex-1 min-w-0 text-left">
                          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: et.cor }} />
                          <span className="truncate">{et.nome}</span>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditEtId(et.id); setEditEtCor(et.cor); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-background rounded"
                          title="Editar cor">
                          <Pencil className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                  </div>
                  <button
                    onClick={() => { setFiltroEtOpen(false); setEtiquetasConfigOpen(false); setEtiquetasOpen(true); }}
                    className="w-full flex items-center gap-2 text-xs px-2 py-1.5 mt-1 rounded border border-dashed border-border hover:bg-accent text-primary font-medium">
                    <Plus className="h-3.5 w-3.5" />
                    Criar Etiqueta
                  </button>
                  <button
                    onClick={() => { setFiltroEtOpen(false); setEtiquetasOpen(false); setEtiquetasConfigOpen(true); }}
                    className="w-full flex items-center gap-2 text-xs px-2 py-1.5 mt-1 rounded border border-border hover:bg-accent font-medium">
                    <Settings2 className="h-3.5 w-3.5" />
                    Configuração de etiquetas
                  </button>
                </PopoverContent>

              </Popover>
              <Button
                variant={filtroJanela24h ? 'default' : 'outline'}
                size="sm"
                className="h-8 px-2"
                onClick={() => setFiltroJanela24h(v => !v)}
                title="Filtrar conversas com janela 24h ativa (verde/amarela)"
              >
                <Clock className={cn('h-3.5 w-3.5', !filtroJanela24h && 'text-green-600')} />
              </Button>
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
            {/* Meus Clientes */}
            <div className="space-y-1.5">
              <Button
                variant={modoMeusClientes ? 'default' : 'outline'}
                size="sm"
                className="w-full h-8 text-xs"
                onClick={() => setModoMeusClientes(v => !v)}
                title="Todas as conversas com a minha etiqueta de atendente"
              >
                <Users className="h-3.5 w-3.5 mr-1" /> Meus Clientes
              </Button>
              {modoMeusClientes && (
                <div className="space-y-1.5 rounded border border-dashed p-2">
                  {!minhaEtiquetaId && (
                    <p className="text-[11px] text-muted-foreground">
                      Nenhuma etiqueta de atendente encontrada para o seu login.
                    </p>
                  )}
                  <div className="flex items-center gap-1">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-1 h-7 text-[11px] justify-start">
                          {mcDataIni ? format(mcDataIni, 'dd/MM/yy') : 'Data inicial'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarPicker mode="single" selected={mcDataIni} onSelect={setMcDataIni} initialFocus locale={ptBR} className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-1 h-7 text-[11px] justify-start">
                          {mcDataFim ? format(mcDataFim, 'dd/MM/yy') : 'Data final'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarPicker mode="single" selected={mcDataFim} onSelect={setMcDataFim} initialFocus locale={ptBR} className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                    {(mcDataIni || mcDataFim) && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setMcDataIni(undefined); setMcDataFim(undefined); }} title="Limpar datas">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <Popover open={mcMarcadoresOpen} onOpenChange={setMcMarcadoresOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full h-7 text-[11px] justify-between">
                        <span>
                          {mcMarcadores.size === 0 ? 'Todos os marcadores' : `${mcMarcadores.size} marcador(es)`}
                        </span>
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2" align="start">
                      <div className="space-y-1 max-h-60 overflow-y-auto">
                        {qualificacoes.filter(q => q.ativo).length === 0 && (
                          <p className="text-[11px] text-muted-foreground">Nenhuma qualificação ativa.</p>
                        )}
                        {qualificacoes.filter(q => q.ativo).map(q => {
                          const on = mcMarcadores.has(q.id);
                          return (
                            <button
                              key={q.id}
                              onClick={() => setMcMarcadores(prev => {
                                const n = new Set(prev);
                                if (n.has(q.id)) n.delete(q.id); else n.add(q.id);
                                return n;
                              })}
                              className={cn(
                                'flex w-full items-center gap-2 rounded px-2 py-1 text-xs hover:bg-accent',
                                on && 'bg-primary/10',
                              )}
                            >
                              {on ? <CheckSquare className="h-3.5 w-3.5 text-primary" /> : <Square className="h-3.5 w-3.5 text-muted-foreground" />}
                              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: q.cor }} />
                              <span className="truncate">{q.nome}</span>
                            </button>
                          );
                        })}
                      </div>
                      {mcMarcadores.size > 0 && (
                        <Button variant="ghost" size="sm" className="w-full h-7 text-[11px] mt-1" onClick={() => setMcMarcadores(new Set())}>
                          Limpar marcadores
                        </Button>
                      )}
                    </PopoverContent>
                  </Popover>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-7 text-[11px]"
                    disabled={mcExportando}
                    onClick={baixarMeusClientesExcel}
                  >
                    {mcExportando
                      ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Gerando...</>
                      : <><Download className="h-3 w-3 mr-1" /> Baixar Excel ({contatosFiltrados.length})</>}
                  </Button>
                </div>

              )}
            </div>
            {/* Caixas de mensagens */}
            <div className="flex flex-wrap items-center gap-1">
              {podeVerPadrao && (
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <button
                      onClick={() => setCurrentFolderId(null)}
                      className={cn(
                        'text-[11px] px-2 py-1 rounded border transition',
                        currentFolderId === null ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/40 text-muted-foreground border-transparent hover:bg-accent',
                      )}
                      title="Caixa padrão (mensagens da equipe)"
                    >
                      Padrão
                    </button>
                  </ContextMenuTrigger>
                  {isAdmin && (
                    <ContextMenuContent>
                      <ContextMenuItem onClick={() => setAcessoFolder({ id: null, nome: 'Padrão' })}>
                        <Users className="h-4 w-4 mr-2" /> Atendentes desta caixa
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => setConfigFolder({ id: null, nome: 'Padrão' })}>
                        <Settings2 className="h-4 w-4 mr-2" /> Configurar caixa
                      </ContextMenuItem>
                    </ContextMenuContent>
                  )}
                </ContextMenu>
              )}
              {foldersVisiveis.map((f) => {
                const podeGerenciar = isAdmin || f.owner_id === user?.id;
                return (
                  <ContextMenu key={f.id}>
                    <ContextMenuTrigger asChild>
                      <button
                        onClick={() => setCurrentFolderId(f.id)}
                        className={cn(
                          'text-[11px] px-2 py-1 rounded border transition',
                          currentFolderId === f.id ? 'text-white border-transparent' : 'bg-muted/40 border-transparent hover:bg-accent',
                        )}
                        style={currentFolderId === f.id ? { backgroundColor: f.cor } : undefined}
                        title={f.nome}
                      >
                        {f.nome}
                      </button>
                    </ContextMenuTrigger>
                    {podeGerenciar && (
                      <ContextMenuContent>
                        <ContextMenuItem onClick={() => setAcessoFolder({ id: f.id, nome: f.nome })}>
                          <Users className="h-4 w-4 mr-2" /> Atendentes desta caixa
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => setConfigFolder({ id: f.id, nome: f.nome })}>
                          <Settings2 className="h-4 w-4 mr-2" /> Configurar caixa
                        </ContextMenuItem>
                        {f.nome.trim().toUpperCase() === 'IA' && (
                          <ContextMenuItem onClick={() => setIaConfigOpen(true)}>
                            <Bot className="h-4 w-4 mr-2" /> Configurar IA
                          </ContextMenuItem>
                        )}
                      </ContextMenuContent>
                    )}
                  </ContextMenu>
                );
              })}
              {isAdmin && foldersVisiveis.some((f) => f.id === currentFolderId && f.nome.trim().toUpperCase() === 'IA') && (
                <button
                  onClick={() => setIaConfigOpen(true)}
                  className="text-[11px] px-2 py-1 rounded border border-dashed border-primary/50 text-primary hover:bg-accent flex items-center gap-1"
                  title="Configurar modelos e regras da IA"
                >
                  <Bot className="h-3 w-3" /> Configurar IA
                </button>
              )}

              {!podeVerPadrao && foldersVisiveis.length === 0 && (
                <span className="text-[11px] text-muted-foreground">
                  Sem caixa de mensagens atribuída — fale com o administrador.
                </span>
              )}

              <button
                onClick={() => setFoldersDialogOpen(true)}
                className="text-[11px] px-1.5 py-1 rounded border border-dashed border-border hover:bg-accent text-muted-foreground"
                title="Gerenciar caixas de mensagens"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
            </>
            )}

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
              // Atendente é exclusivo: exibe no máximo um chip de atendente
              const etsTodas = etiquetas.filter(e => etIds.includes(e.id));
              let atendenteJaExibido = false;
              const ets = etsTodas.filter(e => {
                if (!/^atendente:/i.test(String(e.nome || '').trim())) return true;
                if (atendenteJaExibido) return false;
                atendenteJaExibido = true;
                return true;
              });
              const sel = selecionados.has(c.id);
              const jan = computeJanela(c.ultima_msg_entrada_em);
              return (
                <MetaConversaContextMenu
                  key={c.id}
                  contatoId={c.id}
                  etiquetas={etiquetasMenu}
                  etiquetasGerenciar={etiquetas}
                  contatoEtiquetaIds={etIds}
                  etiquetasBloqueadas={etiquetasBloqueadas[c.id] ?? new Set()}
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
                      qualificacaoAtivaNaCaixa && !(qualifPorContato[c.id]?.length) && !!c.ultima_msg_entrada_em && !ativo && 'pisca-qualificacao',
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
                      <span
                        className={cn(
                          'h-2 w-2 rounded-full ring-2 ring-background',
                          jan.status === 'aberta' && 'bg-emerald-500',
                          jan.status === 'alerta' && 'bg-amber-500 animate-pulse',
                          jan.status === 'fechada' && 'bg-red-500',
                        )}
                        title={
                          jan.status === 'aberta' ? 'Janela 24h aberta'
                            : jan.status === 'alerta' ? 'Janela fecha em menos de 1h'
                            : 'Janela fechada — só template UTILITY'
                        }
                      />
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
            {contatos.length >= limiteContatos && (
              <div className="p-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  disabled={carregandoMais}
                  onClick={() => setLimiteContatos((n) => n + PAGE_CONTATOS)}
                >
                  {carregandoMais ? 'Carregando...' : 'Carregar mais conversas'}
                </Button>
              </div>
            )}
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
            if (f) solicitarConfirmacaoArquivo(f);
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
                  <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                    {contatoAtivo.telefone ? formatTelefone(contatoAtivo.telefone) : (contatoAtivo.bsuid || '—')}
                    {contatoAtivo.telefone && (
                      <CopyButton value={telefoneSemDDI(contatoAtivo.telefone)} label="Telefone" />
                    )}
                    <span>· via {instAtiva?.nome || instAtiva?.display_phone || 'Meta'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {qualificacaoAtivaNaCaixa && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] gap-1"
                      onClick={() => setQualifDialogOpen(true)}
                      title="Qualificar esta conversa"
                    >
                      {(() => {
                        const qs = (qualifPorContato[contatoAtivo.id] ?? [])
                          .map(id => qualificacoes.find(x => x.id === id))
                          .filter(Boolean) as MetaQualificacao[];
                        return (
                          <>
                            {qs.length > 0 ? (
                              <span className="flex items-center -space-x-1">
                                {qs.map(q => (
                                  <span
                                    key={q.id}
                                    className="h-2.5 w-2.5 rounded-full ring-1 ring-background"
                                    style={{ backgroundColor: q.cor }}
                                  />
                                ))}
                              </span>
                            ) : (
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: 'hsl(var(--muted-foreground))' }}
                              />
                            )}
                            {qs.length === 0
                              ? 'Qualificação'
                              : qs.length === 1
                                ? qs[0].nome
                                : `${qs[0].nome} +${qs.length - 1}`}
                          </>
                        );
                      })()}
                    </Button>
                  )}
                  {janelaInfo.status === 'aberta' ? (
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-500 gap-1">
                      <Clock className="h-3 w-3" /> Aberta · fecha em {formatDistanceToNowStrict(new Date(janelaInfo.expiraEm!), { locale: ptBR })}
                    </Badge>
                  ) : janelaInfo.status === 'alerta' ? (
                    <Badge variant="outline" className="border-amber-500/60 bg-amber-500/10 text-amber-600 dark:text-amber-400 gap-1 animate-pulse">
                      <AlertCircle className="h-3 w-3" /> Janela fecha em {formatDistanceToNowStrict(new Date(janelaInfo.expiraEm!), { locale: ptBR })}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-red-500/60 bg-red-500/10 text-red-600 dark:text-red-400 gap-1">
                      <AlertCircle className="h-3 w-3" /> Fechada · envio bloqueado
                    </Badge>
                  )}
                </div>
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
                    {(() => {
                      // Regra "não entregue": saída, status_envio='enviada' e > 15 min sem callback delivered/read/failed.
                      const NAO_ENTREGUE_MIN = 15;
                      const agora = Date.now();
                      const flagsNaoEntregue = mensagens.map(mm =>
                        mm.direcao === 'saida'
                        && (mm.status_envio === 'enviada' || mm.status_envio == null)
                        && !!mm.wa_message_id
                        && (agora - new Date(mm.timestamp_msg).getTime()) > NAO_ENTREGUE_MIN * 60 * 1000
                      );
                      // Índice da última mensagem "não entregue" de cada dia (para exibir o aviso inline apenas uma vez por dia).
                      const ultimaPorDia = new Map<string, number>();
                      mensagens.forEach((mm, i) => {
                        if (!flagsNaoEntregue[i]) return;
                        const dia = new Date(mm.timestamp_msg).toLocaleDateString('pt-BR');
                        ultimaPorDia.set(dia, i);
                      });
                      const idxsAviso = new Set(ultimaPorDia.values());
                      return mensagens.map((m, idx) => {
                        const prev = idx > 0 ? mensagens[idx - 1] : null;
                        const dStr = new Date(m.timestamp_msg).toLocaleDateString('pt-BR');
                        const prevStr = prev ? new Date(prev.timestamp_msg).toLocaleDateString('pt-BR') : null;
                        const sep = !prev || dStr !== prevStr;
                        const naoEntregue = flagsNaoEntregue[idx];
                        const mostraAviso = idxsAviso.has(idx);
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
                                  contatos_payload: (m as any).contatos_payload ?? null,
                                  template_botoes: (m as any).template_botoes ?? null,
                                } as any}
                                formatMsgTime={formatMsgTime}
                                possivelmenteNaoEntregue={naoEntregue}
                              />
                              {mostraAviso && (
                                <div className="w-full flex justify-center mt-1 mb-1 px-2">
                                  <p className="text-[10.5px] leading-snug text-amber-600 dark:text-amber-400 max-w-[85%] text-center">
                                    ⚠️ Esta mensagem pode não ter sido entregue ao WhatsApp do cliente.
                                    Isso costuma acontecer quando o aparelho está offline há muito tempo
                                    ou o cliente ainda não abriu a conversa iniciada pela empresa.
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}
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
                {janelaInfo.status === 'fechada' && (
                  <div className="m-3 text-xs bg-red-500/10 border-2 border-red-500/40 rounded p-3 text-red-700 dark:text-red-400 space-y-1">
                    <div className="flex items-center gap-2 font-semibold">
                      <AlertCircle className="h-4 w-4" />
                      Janela de 24h encerrada — envio livre bloqueado
                    </div>
                    <p>
                      Enviar texto livre agora reclassifica a conversa como <strong>MARKETING (~R$ 0,35/msg)</strong>.
                      Para reabrir, envie um <strong>template UTILITY aprovado</strong> em <strong>Envio Meta</strong> ou
                      aguarde o cliente responder.
                    </p>
                  </div>
                )}
                {janelaInfo.status === 'alerta' && (
                  <div className="m-3 text-xs bg-amber-500/10 border border-amber-500/40 rounded p-2 text-amber-700 dark:text-amber-400 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>
                      <strong>Atenção:</strong> a janela de 24h fecha em <strong>{formatDistanceToNowStrict(new Date(janelaInfo.expiraEm!), { locale: ptBR })}</strong>.
                      Após isso, só será possível reabrir via template UTILITY.
                    </span>
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
                ) : janelaInfo.status === 'fechada' ? (
                  <div className="p-3">
                    <button
                      type="button"
                      onClick={() => setReabrirTemplateOpen(true)}
                      className="w-full flex items-center gap-3 rounded-md border-2 border-dashed border-red-500/40 bg-red-500/5 hover:bg-red-500/10 transition-colors px-4 py-3 text-left"
                    >
                      <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                          Janela 24h fechada — clique para reabrir com template UTILITY
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Apenas templates <strong>UTILITY aprovados</strong> são permitidos aqui. MARKETING é bloqueado.
                        </p>
                      </div>
                      <Send className="h-4 w-4 text-primary shrink-0" />
                    </button>
                  </div>
                ) : (
                  <div className="p-3 flex gap-2 items-end">
                    <input ref={fileInputRef} type="file" className="hidden"
                      accept="image/*,audio/*,video/*,.pdf"
                      onChange={(e) => {
                        const f = e.target.files?.[0]; e.target.value = '';
                        if (f) solicitarConfirmacaoArquivo(f);
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
                      placeholder={janelaInfo.aberta ? 'Digite uma mensagem...' : '🔒 Janela 24h fechada — envie template UTILITY para reabrir'}
                      onSend={(t) => enviar(t)}
                      onPaste={onPaste}
                      onEscape={() => respondendo && setRespondendo(null)}
                      initialText={pendingTranscricao}
                      onInitialTextConsumed={() => setPendingTranscricao('')}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      </div>

      <MetaEtiquetasDialog open={etiquetasOpen} onOpenChange={setEtiquetasOpen} etiquetas={etiquetas} onChange={fetchEtiquetas} isAdmin={isAdmin} />
      <MetaEtiquetasDialog open={etiquetasConfigOpen} onOpenChange={setEtiquetasConfigOpen} etiquetas={etiquetas} onChange={fetchEtiquetas} isAdmin={isAdmin} modoConfig />
      <MetaMensagensRapidasDialog open={msgRapidasOpen} onOpenChange={setMsgRapidasOpen} onChange={fetchMsgRapidas} />
      {user && (
        <MetaFoldersDialog
          open={foldersDialogOpen}
          onOpenChange={setFoldersDialogOpen}
          currentUserId={user.id}
          onChanged={fetchFolders}
        />
      )}
      <MetaFolderAcessoDialog
        open={!!acessoFolder}
        onOpenChange={(v) => { if (!v) setAcessoFolder(null); }}
        folderId={acessoFolder?.id ?? null}
        folderNome={acessoFolder?.nome ?? 'Padrão'}
        onChanged={fetchFolders}
      />
      <MetaIAConfigDialog open={iaConfigOpen} onOpenChange={setIaConfigOpen} />
      <MetaFolderConfigDialog
        open={!!configFolder}
        onOpenChange={(v) => { if (!v) setConfigFolder(null); }}
        folderId={configFolder?.id ?? null}
        folderNome={configFolder?.nome ?? 'Padrão'}
        qualificacaoAtiva={qualifCaixas[configFolder?.id ?? CAIXA_PADRAO_ID] ?? true}
        onChanged={fetchQualificacoes}
      />
      <MetaQualificacaoDialog
        open={qualifDialogOpen}
        onOpenChange={setQualifDialogOpen}
        contatoId={contatoAtivo?.id ?? null}
        contatoNome={contatoAtivo?.nome ?? undefined}
        atuais={contatoAtivo ? (qualifPorContato[contatoAtivo.id] ?? []) : []}
        qualificacoes={qualificacoes}
        isAdmin={isAdmin}
        onQualificar={(cid, qids) => setQualifPorContato(prev => {
          const next = { ...prev };
          if (qids.length) next[cid] = qids; else delete next[cid];
          return next;
        })}
        onQualificacoesChange={fetchQualificacoes}
      />


      <MetaNovaConversaDialog
        open={novaConversaOpen}
        onOpenChange={setNovaConversaOpen}
        instancias={instancias}
        defaultInstancia={filtroInstancia !== 'todas' ? filtroInstancia : undefined}
        atendenteNome={atendenteNome}
        folderId={currentFolderId}
        onSent={() => { fetchContatos(); }}
      />
      {contatoAtivo && (
        <ReabrirComTemplateDialog
          open={reabrirTemplateOpen}
          onOpenChange={setReabrirTemplateOpen}
          instancia_id={contatoAtivo.instancia_id}
          telefone={contatoAtivo.telefone || ''}
          contato_nome={contatoAtivo.nome || undefined}
          atendente_nome={atendenteNome}
          onSent={() => { if (contatoAtivo) fetchMensagens(contatoAtivo, false); }}
        />
      )}

      <ConfirmarEnvioArquivoDialog
        file={arquivoParaConfirmar}
        destinoLabel={
          contatoAtivo
            ? (contatoAtivo.nome ||
               (contatoAtivo.telefone ? formatTelefone(contatoAtivo.telefone) : (contatoAtivo.bsuid || 'Contato')))
            : 'Contato'
        }
        enviando={enviandoArquivo}
        onConfirmar={(f, caption) => enviarMidia(f, caption)}
        onCancelar={() => setArquivoParaConfirmar(null)}
      />

    </AppLayout>
  );
}
