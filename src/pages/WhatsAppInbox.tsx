import { useState, useEffect, useRef, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, MessageSquare, Phone, ArrowDown, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChatMessage } from '@/components/inbox/ChatMessage';
import { ChatInputBar } from '@/components/inbox/ChatInputBar';

interface Instancia {
  id: string;
  nome: string | null;
  server_url: string;
  instance_token: string;
}

interface Contato {
  id: string;
  instancia_id: string;
  telefone: string;
  nome: string | null;
  ultima_mensagem: string | null;
  ultima_mensagem_em: string | null;
  nao_lido: number;
  instancia_nome?: string | null;
}

interface Mensagem {
  id: string;
  instancia_id: string;
  telefone_remoto: string;
  nome_contato: string | null;
  conteudo: string;
  direcao: string;
  timestamp_msg: string;
  lida: boolean;
  tipo_conteudo?: string;
  media_url?: string | null;
}

interface MediaSentPayload {
  conteudo: string;
  tipo_conteudo: 'imagem' | 'documento';
  media_url: string;
}

const getMessageIdentity = (msg: Pick<Mensagem, 'direcao' | 'tipo_conteudo' | 'media_url' | 'conteudo'>) => (
  `${msg.direcao}|${msg.tipo_conteudo || 'texto'}|${msg.media_url || ''}|${msg.conteudo}`
);

export default function WhatsAppInbox() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [instancias, setInstancias] = useState<Instancia[]>([]);
  const [filtroInstancia, setFiltroInstancia] = useState<string>('todas');
  const [busca, setBusca] = useState('');
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [contatoAtivo, setContatoAtivo] = useState<Contato | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [carregandoMensagens, setCarregandoMensagens] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const fetchInstancias = async () => {
      const { data } = await supabase
        .from('user_whatsapp_instances')
        .select('id, nome, server_url, instance_token')
        .eq('ativo', true)
        .eq('user_id', user.id);
      if (data) setInstancias(data);
    };
    fetchInstancias();
  }, [user]);

  const fetchContatos = useCallback(async () => {
    let query = supabase
      .from('whatsapp_contatos')
      .select(`
        id,
        instancia_id,
        telefone,
        nome,
        ultima_mensagem,
        ultima_mensagem_em,
        nao_lido,
        user_whatsapp_instances(nome)
      `)
      .order('ultima_mensagem_em', { ascending: false });

    if (filtroInstancia !== 'todas') {
      query = query.eq('instancia_id', filtroInstancia);
    }

    const { data } = await query;
    if (data) {
      const contatosComNomeInstancia = (data as any[]).map((contato) => ({
        ...contato,
        instancia_nome: contato.user_whatsapp_instances?.nome ?? null,
      }));
      setContatos(contatosComNomeInstancia as Contato[]);
    }
  }, [filtroInstancia]);

  useEffect(() => { fetchContatos(); }, [fetchContatos]);

  useEffect(() => {
    const channel = supabase
      .channel('whatsapp-contatos-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_contatos' }, () => {
        fetchContatos();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchContatos]);

  const fetchMensagens = useCallback(async () => {
    if (!contatoAtivo) return;
    setCarregandoMensagens(true);
    const { data } = await supabase
      .from('whatsapp_mensagens')
      .select('*')
      .eq('instancia_id', contatoAtivo.instancia_id)
      .eq('telefone_remoto', contatoAtivo.telefone)
      .order('timestamp_msg', { ascending: true })
      .limit(100);

    if (data) {
      setMensagens(prev => {
        const persistedMessages = data as Mensagem[];
        const persistedKeys = new Set(persistedMessages.map(getMessageIdentity));
        const unresolvedTempMessages = prev.filter(
          msg => msg.id.startsWith('temp-') && !persistedKeys.has(getMessageIdentity(msg))
        );

        return [...persistedMessages, ...unresolvedTempMessages].sort(
          (a, b) => new Date(a.timestamp_msg).getTime() - new Date(b.timestamp_msg).getTime()
        );
      });
    }
    setCarregandoMensagens(false);
  }, [contatoAtivo]);

  useEffect(() => { fetchMensagens(); }, [fetchMensagens]);

  useEffect(() => {
    if (!contatoAtivo) return;
    const channel = supabase
      .channel('whatsapp-mensagens-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_mensagens' }, (payload) => {
        const newMsg = payload.new as Mensagem;
        if (newMsg.instancia_id === contatoAtivo.instancia_id &&
            newMsg.telefone_remoto === contatoAtivo.telefone) {
          setMensagens(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            const newIdentity = getMessageIdentity(newMsg);
            const filtered = prev.filter(
              msg => !(msg.id.startsWith('temp-') && getMessageIdentity(msg) === newIdentity)
            );
            return [...filtered, newMsg].sort(
              (a, b) => new Date(a.timestamp_msg).getTime() - new Date(b.timestamp_msg).getTime()
            );
          });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [contatoAtivo]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  useEffect(() => {
    if (!contatoAtivo || contatoAtivo.nao_lido === 0) return;
    const markRead = async () => {
      await supabase.from('whatsapp_contatos').update({ nao_lido: 0 }).eq('id', contatoAtivo.id);
      await supabase.from('whatsapp_mensagens').update({ lida: true })
        .eq('instancia_id', contatoAtivo.instancia_id)
        .eq('telefone_remoto', contatoAtivo.telefone)
        .eq('lida', false);
    };
    markRead();
  }, [contatoAtivo]);

  const handleSelectContato = (contato: Contato) => {
    setContatoAtivo(contato);
    setMensagens([]);
  };

  const handleEnviarTexto = async (texto: string) => {
    if (!contatoAtivo || enviando) return;
    const instancia = instancias.find(i => i.id === contatoAtivo.instancia_id);
    if (!instancia) {
      toast({ title: 'Erro', description: 'Instância não encontrada', variant: 'destructive' });
      return;
    }
    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          telefone: contatoAtivo.telefone,
          mensagem: texto,
          uazapi_server_url: instancia.server_url,
          uazapi_instance_token: instancia.instance_token,
          instancia_id: instancia.id,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Falha ao enviar');

      const msgOtimista: Mensagem = {
        id: `temp-${Date.now()}`,
        instancia_id: contatoAtivo.instancia_id,
        telefone_remoto: contatoAtivo.telefone,
        nome_contato: null,
        conteudo: texto,
        direcao: 'saida',
        timestamp_msg: new Date().toISOString(),
        lida: true,
      };
      setMensagens(prev => [...prev, msgOtimista]);
      setTimeout(() => fetchMensagens(), 1500);
    } catch (err: any) {
      toast({ title: 'Erro ao enviar', description: err.message, variant: 'destructive' });
    } finally {
      setEnviando(false);
    }
  };

  const handleMediaSent = useCallback((payload?: MediaSentPayload) => {
    if (payload && contatoAtivo) {
      const msgOtimista: Mensagem = {
        id: `temp-${Date.now()}`,
        instancia_id: contatoAtivo.instancia_id,
        telefone_remoto: contatoAtivo.telefone,
        nome_contato: contatoAtivo.nome,
        conteudo: payload.conteudo,
        direcao: 'saida',
        timestamp_msg: new Date().toISOString(),
        lida: true,
        tipo_conteudo: payload.tipo_conteudo,
        media_url: payload.media_url,
      };
      setMensagens(prev => [...prev, msgOtimista]);
    }

    setTimeout(() => fetchMensagens(), 1500);
  }, [contatoAtivo, fetchMensagens]);

  const contatosFiltrados = contatos
    .filter(c => {
      if (!busca) return true;
      const term = busca.toLowerCase();
      return (c.nome?.toLowerCase().includes(term) || c.telefone.includes(term));
    })
    .sort((a, b) => {
      if (a.nao_lido > 0 && b.nao_lido === 0) return -1;
      if (a.nao_lido === 0 && b.nao_lido > 0) return 1;
      return new Date(b.ultima_mensagem_em || 0).getTime() - new Date(a.ultima_mensagem_em || 0).getTime();
    });

  const getInstanciaNome = (instanciaId: string, instanciaNomeContato?: string | null) => {
    if (instanciaNomeContato) return instanciaNomeContato;
    const inst = instancias.find(i => i.id === instanciaId);
    return inst?.nome || null;
  };

  const formatTelefone = (tel: string) => {
    if (tel.length === 13) return `+${tel.slice(0, 2)} (${tel.slice(2, 4)}) ${tel.slice(4, 9)}-${tel.slice(9)}`;
    if (tel.length === 12) return `+${tel.slice(0, 2)} (${tel.slice(2, 4)}) ${tel.slice(4, 8)}-${tel.slice(8)}`;
    return tel;
  };

  const formatMsgTime = (ts: string) => {
    try {
      const date = new Date(ts);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
      if (diffDays === 0) return format(date, 'HH:mm');
      if (diffDays === 1) return 'Ontem';
      if (diffDays < 7) return format(date, 'EEEE', { locale: ptBR });
      return format(date, 'dd/MM/yy');
    } catch { return ''; }
  };

  const activeInstancia = contatoAtivo
    ? instancias.find(i => i.id === contatoAtivo.instancia_id)
    : null;

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-5rem)] lg:h-[calc(100vh-2rem)] rounded-lg overflow-hidden border border-border bg-card">
        <div className={cn(
          'w-full md:w-80 lg:w-96 md:min-w-[20rem] lg:min-w-[24rem] md:max-w-[20rem] lg:max-w-[24rem] shrink-0 border-r border-border flex flex-col bg-card overflow-hidden',
          contatoAtivo ? 'hidden md:flex' : 'flex'
        )}>
          <div className="p-3 border-b border-border space-y-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-foreground">WhatsApp Inbox</h2>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar contato..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9 h-9 text-sm" />
            </div>
            {instancias.length > 1 && (
              <Select value={filtroInstancia} onValueChange={setFiltroInstancia}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todas as instâncias" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as instâncias</SelectItem>
                  {instancias.map(inst => (
                    <SelectItem key={inst.id} value={inst.id}>{inst.nome || 'Instância'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <ScrollArea className="flex-1 [&>[data-radix-scroll-area-viewport]>div]:!block">
            {contatosFiltrados.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhuma conversa ainda</p>
                <p className="text-xs mt-1">As mensagens aparecerão aqui quando chegarem</p>
              </div>
            ) : (
              contatosFiltrados.map(contato => (
                <button
                  key={contato.id}
                  onClick={() => handleSelectContato(contato)}
                  className={cn(
                    'w-full flex items-start gap-3 p-3 hover:bg-accent/50 transition-colors text-left border-b border-border/50 overflow-hidden',
                    contatoAtivo?.id === contato.id && 'bg-accent'
                  )}
                >
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <Phone className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm text-foreground truncate block min-w-0 flex-1">
                        {contato.nome || formatTelefone(contato.telefone)}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                        {contato.ultima_mensagem_em && formatMsgTime(contato.ultima_mensagem_em)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className="text-xs text-muted-foreground truncate block min-w-0 flex-1">
                        {contato.ultima_mensagem || 'Sem mensagens'}
                      </p>
                      {contato.nao_lido > 0 && (
                        <Badge className="h-5 min-w-[20px] text-xs bg-primary text-primary-foreground shrink-0">
                          {contato.nao_lido}
                        </Badge>
                      )}
                    </div>
                    {getInstanciaNome(contato.instancia_id, contato.instancia_nome) && (
                      <span className="text-[10px] text-muted-foreground/60 mt-0.5 block truncate">
                        {getInstanciaNome(contato.instancia_id, contato.instancia_nome)}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </ScrollArea>
        </div>

        <div className={cn('flex-1 flex flex-col', !contatoAtivo ? 'hidden md:flex' : 'flex')}>
          {!contatoAtivo ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg">Selecione uma conversa</p>
                <p className="text-sm mt-1">Escolha um contato para ver as mensagens</p>
              </div>
            </div>
          ) : (
            <>
              <div className="p-3 border-b border-border flex items-center gap-3 bg-card">
                <button className="md:hidden text-muted-foreground" onClick={() => setContatoAtivo(null)}>
                  <ArrowDown className="h-5 w-5 rotate-90" />
                </button>
                <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center">
                  <Phone className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">
                    {contatoAtivo.nome || formatTelefone(contatoAtivo.telefone)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatTelefone(contatoAtivo.telefone)}
                    {getInstanciaNome(contatoAtivo.instancia_id, contatoAtivo.instancia_nome) && ` · ${getInstanciaNome(contatoAtivo.instancia_id, contatoAtivo.instancia_nome)}`}
                  </p>
                </div>
              </div>

              <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-2 bg-background/50 relative"
                style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%239C92AC\' fill-opacity=\'0.03\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) setDroppedFile(file);
                }}
              >
                {dragOver && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded-lg">
                    <div className="flex flex-col items-center gap-2 text-primary">
                      <Upload className="h-10 w-10" />
                      <span className="font-medium text-sm">Solte o arquivo aqui</span>
                    </div>
                  </div>
                )}
                {carregandoMensagens ? (
                  <div className="text-center text-muted-foreground text-sm py-8">Carregando...</div>
                ) : mensagens.length === 0 ? (
                  <div className="text-center text-muted-foreground text-sm py-8">Nenhuma mensagem</div>
                ) : (
                  mensagens.map(msg => (
                    <ChatMessage key={msg.id} msg={msg} formatMsgTime={formatMsgTime} />
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {activeInstancia && (
                <ChatInputBar
                  instanciaId={activeInstancia.id}
                  telefone={contatoAtivo.telefone}
                  serverUrl={activeInstancia.server_url}
                  instanceToken={activeInstancia.instance_token}
                  onTextSent={handleEnviarTexto}
                  onMediaSent={handleMediaSent}
                  enviando={enviando}
                  externalFile={droppedFile}
                  onExternalFileHandled={() => setDroppedFile(null)}
                />
              )}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
