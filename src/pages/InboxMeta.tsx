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
import { Search, Send, Loader2, ShieldCheck, AlertCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNowStrict, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChatMessage } from '@/components/inbox/ChatMessage';

interface MetaInstance {
  id: string;
  nome: string | null;
  display_phone: string | null;
  ativo: boolean;
}

interface MetaContato {
  id: string;
  instancia_id: string;
  telefone: string;
  nome: string | null;
  ultima_mensagem: string | null;
  ultima_mensagem_em: string | null;
  ultima_msg_entrada_em: string | null;
  nao_lido: number;
}

interface MetaMensagem {
  id: string;
  instancia_id: string;
  telefone: string;
  conteudo: string;
  direcao: string;
  timestamp_msg: string;
  tipo_conteudo?: string;
  media_url?: string | null;
  wa_message_id?: string | null;
  status_envio?: string | null;
}

const PAGE_SIZE = 200;
const JANELA_24H_MS = 24 * 60 * 60 * 1000;

function formatTelefone(t: string) {
  const d = t.replace(/\D/g, '');
  if (d.length >= 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9, 13)}`;
  if (d.length >= 12) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  return t;
}

function formatMsgTime(ts: string) {
  try { return format(new Date(ts), 'HH:mm', { locale: ptBR }); } catch { return ''; }
}

function formatContatoTime(ts: string | null) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    const hoje = new Date();
    if (d.toDateString() === hoje.toDateString()) return format(d, 'HH:mm');
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
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [carregandoMsgs, setCarregandoMsgs] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Carrega instâncias Meta
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('meta_whatsapp_instances')
        .select('id, nome, display_phone, ativo')
        .eq('ativo', true)
        .order('nome', { ascending: true });
      setInstancias((data as MetaInstance[]) ?? []);
    })();
  }, [user]);

  // Carrega contatos
  const fetchContatos = useCallback(async () => {
    if (!user) return;
    let q = supabase
      .from('meta_whatsapp_contatos')
      .select('id, instancia_id, telefone, nome, ultima_mensagem, ultima_mensagem_em, ultima_msg_entrada_em, nao_lido')
      .order('ultima_mensagem_em', { ascending: false, nullsFirst: false })
      .limit(500);
    if (filtroInstancia !== 'todas') q = q.eq('instancia_id', filtroInstancia);
    const { data } = await q;
    setContatos((data as MetaContato[]) ?? []);
  }, [user, filtroInstancia]);

  useEffect(() => { fetchContatos(); }, [fetchContatos]);

  // Realtime: contatos
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('meta-contatos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meta_whatsapp_contatos' }, () => {
        fetchContatos();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchContatos]);

  // Carrega mensagens do contato ativo
  const fetchMensagens = useCallback(async (contato: MetaContato) => {
    setCarregandoMsgs(true);
    const { data } = await supabase
      .from('meta_whatsapp_mensagens')
      .select('*')
      .eq('instancia_id', contato.instancia_id)
      .eq('telefone', contato.telefone)
      .order('timestamp_msg', { ascending: false })
      .limit(PAGE_SIZE);
    const lista = ((data as MetaMensagem[]) ?? []).reverse();
    setMensagens(lista);
    setCarregandoMsgs(false);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 50);

    // Marca como lido
    if (contato.nao_lido > 0) {
      await supabase.from('meta_whatsapp_contatos').update({ nao_lido: 0 }).eq('id', contato.id);
    }
  }, []);

  useEffect(() => {
    if (contatoAtivo) fetchMensagens(contatoAtivo);
    else setMensagens([]);
  }, [contatoAtivo, fetchMensagens]);

  // Realtime: mensagens do contato ativo
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

  // Filtro de busca
  const contatosFiltrados = useMemo(() => {
    const b = busca.trim().toLowerCase();
    if (!b) return contatos;
    return contatos.filter(c =>
      (c.nome || '').toLowerCase().includes(b) ||
      c.telefone.includes(b.replace(/\D/g, ''))
    );
  }, [contatos, busca]);

  // Janela 24h
  const janelaInfo = useMemo(() => {
    if (!contatoAtivo?.ultima_msg_entrada_em) {
      return { aberta: false, expiraEm: null as string | null, restantesMin: 0 };
    }
    const ultima = new Date(contatoAtivo.ultima_msg_entrada_em).getTime();
    const fim = ultima + JANELA_24H_MS;
    const restanteMs = fim - Date.now();
    return {
      aberta: restanteMs > 0,
      expiraEm: new Date(fim).toISOString(),
      restantesMin: Math.max(0, Math.floor(restanteMs / 60000)),
    };
  }, [contatoAtivo]);

  const enviar = async () => {
    if (!contatoAtivo || !texto.trim() || enviando) return;
    if (!janelaInfo.aberta) {
      toast({
        title: 'Janela de 24h expirada',
        description: 'Use um template HSM em "Envio Meta (massa)" para reabrir a conversa.',
        variant: 'destructive',
      });
      return;
    }
    setEnviando(true);
    const tempId = `temp-${Date.now()}`;
    const tempMsg: MetaMensagem = {
      id: tempId,
      instancia_id: contatoAtivo.instancia_id,
      telefone: contatoAtivo.telefone,
      conteudo: texto,
      direcao: 'saida',
      timestamp_msg: new Date().toISOString(),
      tipo_conteudo: 'texto',
      status_envio: 'enviando',
    };
    setMensagens(prev => [...prev, tempMsg]);
    const textoEnviar = texto;
    setTexto('');
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 30);

    try {
      const { data, error } = await supabase.functions.invoke('send-whatsapp-meta-text', {
        body: {
          instancia_id: contatoAtivo.instancia_id,
          telefone: contatoAtivo.telefone,
          texto: textoEnviar,
          user_id: user?.id,
        },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) {
        throw new Error(data?.error || 'Falha ao enviar');
      }
      // Remove temp; o INSERT real virá via realtime
      setMensagens(prev => prev.filter(m => m.id !== tempId));
    } catch (e: any) {
      setMensagens(prev => prev.map(m => m.id === tempId ? { ...m, status_envio: 'erro' } : m));
      toast({ title: 'Erro ao enviar', description: e.message || 'Falha', variant: 'destructive' });
    } finally {
      setEnviando(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  };

  const instAtiva = useMemo(
    () => instancias.find(i => i.id === contatoAtivo?.instancia_id),
    [instancias, contatoAtivo],
  );

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-4rem)] gap-0 overflow-hidden">
        {/* Sidebar de contatos */}
        <div className="w-full sm:w-[360px] border-r flex flex-col bg-card">
          <div className="p-3 border-b space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <h2 className="text-sm font-semibold">Inbox API Oficial Meta</h2>
              <Badge variant="outline" className="ml-auto text-[10px] border-emerald-500/40 text-emerald-500">
                Oficial
              </Badge>
            </div>
            <Select value={filtroInstancia} onValueChange={setFiltroInstancia}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Número Meta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todos os números ({instancias.length})</SelectItem>
                {instancias.map(i => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.nome || i.display_phone || i.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar contato ou telefone"
                className="pl-7 h-8 text-xs"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            {contatosFiltrados.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                Nenhuma conversa ainda. Mensagens recebidas nos seus números Meta aparecem aqui automaticamente.
              </div>
            ) : contatosFiltrados.map(c => {
              const inst = instancias.find(i => i.id === c.instancia_id);
              const ativo = contatoAtivo?.id === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setContatoAtivo(c)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 border-b hover:bg-accent/50 transition flex flex-col gap-0.5',
                    ativo && 'bg-accent',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">
                      {c.nome || formatTelefone(c.telefone)}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatContatoTime(c.ultima_mensagem_em)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground truncate">
                      {c.ultima_mensagem || '—'}
                    </span>
                    {c.nao_lido > 0 && (
                      <Badge className="h-4 min-w-[16px] px-1 text-[10px] bg-emerald-500 text-white">
                        {c.nao_lido}
                      </Badge>
                    )}
                  </div>
                  <div className="text-[10px] text-emerald-500/80 truncate">
                    {inst?.nome || inst?.display_phone || ''}
                  </div>
                </button>
              );
            })}
          </ScrollArea>
        </div>

        {/* Painel da conversa */}
        <div className="flex-1 flex flex-col bg-background min-w-0">
          {!contatoAtivo ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Selecione uma conversa para começar
            </div>
          ) : (
            <>
              <div className="p-3 border-b flex items-center justify-between bg-card">
                <div>
                  <div className="text-sm font-semibold">
                    {contatoAtivo.nome || formatTelefone(contatoAtivo.telefone)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatTelefone(contatoAtivo.telefone)} · via {instAtiva?.nome || instAtiva?.display_phone || 'Meta'}
                  </div>
                </div>
                {janelaInfo.aberta ? (
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-500 gap-1">
                    <Clock className="h-3 w-3" /> Janela aberta · {formatDistanceToNowStrict(new Date(janelaInfo.expiraEm!), { locale: ptBR })}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-amber-500/40 text-amber-500 gap-1">
                    <AlertCircle className="h-3 w-3" /> 24h expiradas
                  </Badge>
                )}
              </div>

              <ScrollArea className="flex-1 p-3">
                {carregandoMsgs ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {mensagens.map(m => (
                      <ChatMessage
                        key={m.id}
                        msg={{
                          id: m.id,
                          conteudo: m.conteudo,
                          direcao: m.direcao,
                          timestamp_msg: m.timestamp_msg,
                          tipo_conteudo: m.tipo_conteudo,
                          media_url: m.media_url,
                          whatsapp_msg_id: m.wa_message_id,
                          status_envio: m.status_envio,
                        }}
                        formatMsgTime={formatMsgTime}
                      />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              <div className="p-3 border-t bg-card space-y-2">
                {!janelaInfo.aberta && (
                  <div className="text-xs bg-amber-500/10 border border-amber-500/30 rounded p-2 text-amber-700 dark:text-amber-400">
                    <strong>Janela de 24h expirada.</strong> A Meta só permite mensagens livres se o cliente tiver te respondido nas últimas 24 horas. Para reabrir a conversa, envie um template HSM em <strong>Envio Meta (massa)</strong>.
                  </div>
                )}
                <div className="flex gap-2 items-end">
                  <Textarea
                    value={texto}
                    onChange={e => setTexto(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder={janelaInfo.aberta ? 'Digite uma mensagem (Enter envia, Shift+Enter quebra linha)' : 'Janela de 24h expirada — envie um template HSM'}
                    disabled={!janelaInfo.aberta || enviando}
                    className="min-h-[44px] max-h-[120px] resize-none"
                    rows={1}
                  />
                  <Button
                    onClick={enviar}
                    disabled={!janelaInfo.aberta || !texto.trim() || enviando}
                    size="icon"
                    className="shrink-0"
                  >
                    {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
