import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import ReactMarkdown from 'react-markdown';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Bot, Settings, Play, Square, RefreshCw, Send, Loader2, Wifi, WifiOff, Terminal, List, Clock, MessageCircle, Monitor, Brain, Zap, GraduationCap, Trash2, Eye, Upload, Video, FileVideo, ImagePlus, X } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { RoboStreamViewer } from '@/components/RoboStreamViewer';
import { RoboCodeViewer } from '@/components/RoboCodeViewer';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

const ACOES_DISPONIVEIS = [
  { value: 'navegar', label: '🌐 Navegar para URL', requiresValue: true, valueLabel: 'URL' },
  { value: 'clicar', label: '👆 Clicar em elemento', requiresValue: true, valueLabel: 'Seletor CSS' },
  { value: 'digitar', label: '⌨️ Digitar texto', requiresValue: true, valueLabel: 'Seletor CSS', requiresSecondValue: true, secondValueLabel: 'Texto' },
  { value: 'esperar', label: '⏱️ Esperar (ms)', requiresValue: true, valueLabel: 'Milissegundos' },
  { value: 'screenshot', label: '📸 Tirar Screenshot', requiresValue: false },
  { value: 'scroll', label: '📜 Rolar página', requiresValue: true, valueLabel: 'Pixels (ex: 500)' },
  { value: 'executar_js', label: '⚡ Executar JavaScript', requiresValue: true, valueLabel: 'Código JS' },
];

export default function AutomacaoCobMais() {
  const [serverUrl, setServerUrl] = useState('');
  const [roboStatus, setRoboStatus] = useState<'offline' | 'online' | 'loading'>('offline');
  const [comandos, setComandos] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [sessoes, setSessoes] = useState<any[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSessionId, setRecordingSessionId] = useState<string | null>(null);
  const [showRecordDialog, setShowRecordDialog] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [viewingSessaoId, setViewingSessaoId] = useState<string | null>(null);
  const [selectedSessaoKnowledge, setSelectedSessaoKnowledge] = useState<any[]>([]);
  const [showVideoUpload, setShowVideoUpload] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoDescription, setVideoDescription] = useState('');
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);

  // Console de comandos
  const [consoleAcao, setConsoleAcao] = useState('');
  const [consoleValor, setConsoleValor] = useState('');
  const [consoleValor2, setConsoleValor2] = useState('');
  const [isExecutingCommand, setIsExecutingCommand] = useState(false);

  // Chat com IA
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatImage, setChatImage] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatAbortRef = useRef<AbortController | null>(null);
  const chatImageInputRef = useRef<HTMLInputElement>(null);
  const prevMsgCountRef = useRef(0);
  const streamingRef = useRef<HTMLDivElement>(null);

  const selectedAcao = useMemo(() => ACOES_DISPONIVEIS.find(a => a.value === consoleAcao), [consoleAcao]);

  useEffect(() => {
    loadConfig();
    loadComandos();
    loadLogs();
    loadSessoes();
    loadChatHistory();
    const interval = setInterval(() => {
      loadComandos();
      loadLogs();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (chatMessages.length > prevMsgCountRef.current) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      prevMsgCountRef.current = chatMessages.length;
    }
  }, [chatMessages]);

  const loadConfig = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('robo_config').select('*').eq('user_id', user.id).single();
    if (data) {
      setServerUrl(data.server_url || '');
      setRoboStatus(data.status || 'offline');
    }
  };

  const loadComandos = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('robo_comandos').select('*').eq('user_id', user.id).order('criado_em', { ascending: false }).limit(50);
    if (data) setComandos(data);
  };

  const loadLogs = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('robo_logs').select('*').eq('user_id', user.id).order('criado_em', { ascending: false }).limit(100);
    if (data) setLogs(data);
  };

  const loadSessoes = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('robo_sessoes_gravadas').select('*').eq('user_id', user.id).order('criado_em', { ascending: false });
    if (data) setSessoes(data);
  };

  const loadChatHistory = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('chat_ia_mensagens').select('*').eq('user_id', user.id).order('criado_em', { ascending: true });
    if (data) {
      const msgs = data.map(m => ({
        role: m.role,
        content: m.content,
        image: m.image_url
      }));
      setChatMessages(msgs);
      prevMsgCountRef.current = msgs.length;
    }
  };

  const handleSaveConfig = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('robo_config').upsert({
      user_id: user.id,
      server_url: serverUrl,
      status: roboStatus,
      atualizado_em: new Date().toISOString()
    });
    if (error) {
      toast.error('Erro ao salvar configuração');
    } else {
      toast.success('Configuração salva');
    }
  };

  const handleStartRobo = async () => {
    if (!serverUrl) {
      toast.error('Configure a URL do servidor primeiro');
      return;
    }
    setRoboStatus('loading');
    try {
      const res = await fetch(`${serverUrl}/start`, { method: 'POST' });
      if (res.ok) {
        setRoboStatus('online');
        toast.success('Robô iniciado');
        await handleSaveConfig();
      } else {
        throw new Error('Falha ao iniciar');
      }
    } catch (err) {
      setRoboStatus('offline');
      toast.error('Erro ao iniciar robô');
    }
  };

  const handleStopRobo = async () => {
    if (!serverUrl) return;
    setRoboStatus('loading');
    try {
      const res = await fetch(`${serverUrl}/stop`, { method: 'POST' });
      if (res.ok) {
        setRoboStatus('offline');
        toast.success('Robô parado');
        await handleSaveConfig();
      } else {
        throw new Error('Falha ao parar');
      }
    } catch (err) {
      toast.error('Erro ao parar robô');
    }
  };

  const handleExecuteConsoleCommand = async () => {
    if (!consoleAcao) {
      toast.error('Selecione uma ação');
      return;
    }
    if (selectedAcao?.requiresValue && !consoleValor) {
      toast.error(`Preencha o campo ${selectedAcao.valueLabel}`);
      return;
    }
    if (selectedAcao?.requiresSecondValue && !consoleValor2) {
      toast.error(`Preencha o campo ${selectedAcao.secondValueLabel}`);
      return;
    }

    setIsExecutingCommand(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsExecutingCommand(false);
      return;
    }

    const payload: any = {
      user_id: user.id,
      acao: consoleAcao,
      status: 'pendente'
    };

    if (consoleAcao === 'digitar') {
      payload.seletor = consoleValor;
      payload.valor = consoleValor2;
    } else if (selectedAcao?.requiresValue) {
      if (consoleAcao === 'navegar') {
        payload.valor = consoleValor;
      } else if (consoleAcao === 'clicar') {
        payload.seletor = consoleValor;
      } else if (consoleAcao === 'esperar') {
        payload.valor = consoleValor;
      } else if (consoleAcao === 'scroll') {
        payload.valor = consoleValor;
      } else if (consoleAcao === 'executar_js') {
        payload.valor = consoleValor;
      }
    }

    const { error } = await supabase.from('robo_comandos').insert(payload);
    if (error) {
      toast.error('Erro ao enviar comando');
    } else {
      toast.success('Comando enviado');
      setConsoleAcao('');
      setConsoleValor('');
      setConsoleValor2('');
      loadComandos();
    }
    setIsExecutingCommand(false);
  };

  const handleStartRecording = async () => {
    if (!newSessionName.trim()) {
      toast.error('Digite um nome para a sessão');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase.from('robo_sessoes_gravadas').insert({
      user_id: user.id,
      nome: newSessionName,
      status: 'gravando'
    }).select().single();

    if (error || !data) {
      toast.error('Erro ao iniciar gravação');
      return;
    }

    setRecordingSessionId(data.id);
    setIsRecording(true);
    setShowRecordDialog(false);
    setNewSessionName('');
    toast.success('Gravação iniciada! Execute as ações no CobMais.');
    loadSessoes();

    if (streamingRef.current) {
      streamingRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleStopRecording = async () => {
    if (!recordingSessionId) return;
    const { error } = await supabase.from('robo_sessoes_gravadas').update({
      status: 'concluida',
      atualizado_em: new Date().toISOString()
    }).eq('id', recordingSessionId);

    if (error) {
      toast.error('Erro ao finalizar gravação');
      return;
    }

    setIsRecording(false);
    setRecordingSessionId(null);
    toast.success('Gravação finalizada e salva no conhecimento');
    loadSessoes();
  };

  const handleViewKnowledge = async (sessaoId: string) => {
    if (viewingSessaoId === sessaoId) {
      setViewingSessaoId(null);
      setSelectedSessaoKnowledge([]);
      return;
    }
    const { data } = await supabase.from('robo_conhecimento').select('*').eq('sessao_id', sessaoId).order('passo_numero', { ascending: true });
    if (data) {
      setSelectedSessaoKnowledge(data);
      setViewingSessaoId(sessaoId);
    }
  };

  const handleDeleteSession = async (sessaoId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta sessão?')) return;
    await supabase.from('robo_conhecimento').delete().eq('sessao_id', sessaoId);
    const { error } = await supabase.from('robo_sessoes_gravadas').delete().eq('id', sessaoId);
    if (error) {
      toast.error('Erro ao excluir sessão');
    } else {
      toast.success('Sessão excluída');
      loadSessoes();
      if (viewingSessaoId === sessaoId) {
        setViewingSessaoId(null);
        setSelectedSessaoKnowledge([]);
      }
    }
  };

  const handleChatImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande (máx 5MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setChatImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() && !chatImage) return;

    const userMessage: any = {
      role: 'user',
      content: chatInput.trim() || 'Veja a imagem anexada'
    };
    if (chatImage) userMessage.image = chatImage;

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    const imageToSend = chatImage;
    setChatImage(null);
    setIsChatLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsChatLoading(false);
      return;
    }

    await supabase.from('chat_ia_mensagens').insert({
      user_id: user.id,
      role: 'user',
      content: userMessage.content,
      image_url: imageToSend
    });

    const abortController = new AbortController();
    chatAbortRef.current = abortController;

    try {
      const { data: knowledgeData } = await supabase.from('robo_conhecimento').select('*').eq('user_id', user.id).order('criado_em', { ascending: false }).limit(100);
      const knowledge = knowledgeData || [];

      const messages = [...chatMessages, userMessage].map(m => {
        if (m.role === 'user' && m.image) {
          return {
            role: 'user',
            content: [
              { type: 'text', text: m.content },
              { type: 'image_url', image_url: { url: m.image } }
            ]
          };
        }
        return { role: m.role, content: m.content };
      });

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `Você é um assistente especializado em automação do sistema CobMais. Seu papel é:
1. Responder perguntas sobre o que você sabe fazer (baseado no conhecimento aprendido)
2. Identificar lacunas no seu conhecimento e pedir treinamento
3. Quando o usuário enviar uma imagem/screenshot, analisar e sugerir como automatizar aquela tela

Conhecimento atual (${knowledge.length} passos aprendidos):
${knowledge.map(k => `- ${k.acao} ${k.seletor || ''} ${k.valor || ''} (${k.descricao_tela || 'sem descrição'})`).join('\n')}

Se você não souber fazer algo, seja honesto e peça um vídeo de treinamento usando o emoji 📹.
Se o usuário enviar uma imagem, descreva o que vê e sugira como automatizar.`
            },
            ...messages
          ],
          max_tokens: 1000,
          temperature: 0.7
        }),
        signal: abortController.signal
      });

      if (!res.ok) throw new Error('Erro na API');
      const data = await res.json();
      const assistantMessage = {
        role: 'assistant',
        content: data.choices[0].message.content
      };

      setChatMessages(prev => [...prev, assistantMessage]);
      await supabase.from('chat_ia_mensagens').insert({
        user_id: user.id,
        role: 'assistant',
        content: assistantMessage.content
      });
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        toast.error('Erro ao conversar com IA');
        setChatMessages(prev => prev.slice(0, -1));
      }
    } finally {
      setIsChatLoading(false);
      chatAbortRef.current = null;
    }
  };

  const handleVideoUpload = async () => {
    if (!videoFile || !videoDescription.trim()) {
      toast.error('Selecione um vídeo e adicione uma descrição');
      return;
    }

    setIsUploadingVideo(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsUploadingVideo(false);
      return;
    }

    try {
      const fileName = `${user.id}/${Date.now()}_${videoFile.name}`;
      const { error: uploadError } = await supabase.storage.from('training-videos').upload(fileName, videoFile);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('training-videos').getPublicUrl(fileName);

      const { error: dbError } = await supabase.from('robo_sessoes_gravadas').insert({
        user_id: user.id,
        nome: videoDescription,
        status: 'video_treinamento',
        video_url: urlData.publicUrl
      });

      if (dbError) throw dbError;

      toast.success('Vídeo enviado! A IA irá processar e aprender com ele.');
      setShowVideoUpload(false);
      setVideoFile(null);
      setVideoDescription('');
      loadSessoes();
    } catch (err) {
      toast.error('Erro ao enviar vídeo');
    } finally {
      setIsUploadingVideo(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Bot className="h-8 w-8" />
              🤖 Automação CobMais
            </h1>
            <p className="text-muted-foreground mt-1">
              Robô inteligente que aprende a usar o CobMais assistindo você trabalhar
            </p>
          </div>
          <div className="flex items-center gap-2">
            {roboStatus === 'online' ? (
              <Badge variant="default" className="gap-1">
                <Wifi className="h-3 w-3" /> Online
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <WifiOff className="h-3 w-3" /> Offline
              </Badge>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configuração
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="serverUrl">URL do Servidor do Robô</Label>
                <Input
                  id="serverUrl"
                  placeholder="http://localhost:3000"
                  value={serverUrl}
                  onChange={e => setServerUrl(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveConfig} variant="outline" className="flex-1">
                  <Settings className="h-4 w-4 mr-1" /> Salvar
                </Button>
                {roboStatus === 'offline' ? (
                  <Button onClick={handleStartRobo} disabled={roboStatus === 'loading'} className="flex-1">
                    {roboStatus === 'loading' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
                    Iniciar
                  </Button>
                ) : (
                  <Button onClick={handleStopRobo} variant="destructive" disabled={roboStatus === 'loading'} className="flex-1">
                    <Square className="h-4 w-4 mr-1" /> Parar
                  </Button>
                )}
              </div>
              <Separator />
              <div className="flex gap-2">
                {isRecording ? (
                  <Button onClick={handleStopRecording} variant="destructive" className="flex-1">
                    <Square className="h-4 w-4 mr-1" /> Parar Gravação
                  </Button>
                ) : (
                  <Button onClick={() => setShowRecordDialog(true)} variant="outline" className="flex-1" disabled={roboStatus !== 'online'}>
                    <Video className="h-4 w-4 mr-1" /> Gravar Sessão
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5" />
                Console de Comandos
              </CardTitle>
              <CardDescription>Execute comandos individuais no robô</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Ação</Label>
                <Select value={consoleAcao} onValueChange={setConsoleAcao}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma ação" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACOES_DISPONIVEIS.map(acao => (
                      <SelectItem key={acao.value} value={acao.value}>
                        {acao.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedAcao?.requiresValue && (
                <div className="space-y-2">
                  <Label>{selectedAcao.valueLabel}</Label>
                  <Input
                    placeholder={selectedAcao.valueLabel}
                    value={consoleValor}
                    onChange={e => setConsoleValor(e.target.value)}
                  />
                </div>
              )}

              {selectedAcao?.requiresSecondValue && (
                <div className="space-y-2">
                  <Label>{selectedAcao.secondValueLabel}</Label>
                  <Input
                    placeholder={selectedAcao.secondValueLabel}
                    value={consoleValor2}
                    onChange={e => setConsoleValor2(e.target.value)}
                  />
                </div>
              )}

              <Button onClick={handleExecuteConsoleCommand} disabled={!consoleAcao || isExecutingCommand || roboStatus !== 'online'} className="w-full">
                {isExecutingCommand ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Zap className="h-4 w-4 mr-1" />}
                Executar
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* 2. Chat com IA sobre o conhecimento */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                💬 Conversar com a IA sobre o Conhecimento
              </CardTitle>
              <CardDescription>
                Pergunte à IA o que ela aprendeu, se tem dúvidas ou se precisa de mais treinamento.
              </CardDescription>
            </div>
            {chatMessages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={async () => {
                  const { data: { user } } = await supabase.auth.getUser();
                  if (user) await supabase.from('chat_ia_mensagens').delete().eq('user_id', user.id);
                  setChatMessages([]);
                  prevMsgCountRef.current = 0;
                  toast.success('Histórico limpo');
                }}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Limpar
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Messages area */}
              <ScrollArea className="h-80 rounded-md border p-4 bg-muted/30">
                <div className="space-y-4">
                  {chatMessages.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <Brain className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">Comece perguntando algo como:</p>
                      <div className="flex flex-wrap gap-2 justify-center mt-3">
                        {['O que você sabe fazer?', 'Tem alguma dúvida?', 'Sabe gerar boleto?'].map(q => (
                          <Button key={q} variant="outline" size="sm" onClick={() => { setChatInput(q); }}>
                            {q}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                  {chatMessages.map((msg, i) => {
                    const textContent = typeof msg.content === 'string' 
                      ? msg.content 
                      : (msg.content as any[])?.find((c: any) => c.type === 'text')?.text || '';
                    return (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-card border'
                      }`}>
                        {msg.role === 'assistant' ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown>{textContent}</ReactMarkdown>
                            {textContent.includes('📹') && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-2"
                                onClick={() => setShowVideoUpload(true)}
                              >
                                <FileVideo className="h-4 w-4 mr-1" />
                                Enviar Vídeo de Treinamento
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div>
                            {msg.image && (
                              <img src={msg.image} alt="Screenshot enviado" className="rounded-md max-h-48 mb-2" />
                            )}
                            <p>{textContent}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    );
                  })}
                  {isChatLoading && chatMessages[chatMessages.length - 1]?.role !== 'assistant' && (
                    <div className="flex justify-start">
                      <div className="bg-card border rounded-lg px-4 py-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>

              {/* Image preview */}
              {chatImage && (
                <div className="relative inline-block">
                  <img src={chatImage} alt="Preview" className="rounded-md max-h-32 border" />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                    onClick={() => setChatImage(null)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}

              {/* Input area */}
              <input
                type="file"
                accept="image/*"
                ref={chatImageInputRef}
                className="hidden"
                onChange={handleChatImageSelect}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => chatImageInputRef.current?.click()}
                  disabled={isChatLoading}
                  title="Anexar imagem/screenshot"
                >
                  <ImagePlus className="h-4 w-4" />
                </Button>
                <Input
                  placeholder="Pergunte à IA ou envie um print mostrando onde clicar..."
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend(); } }}
                  onPaste={e => {
                    const items = e.clipboardData?.items;
                    if (!items) return;
                    for (const item of Array.from(items)) {
                      if (item.type.startsWith('image/')) {
                        e.preventDefault();
                        const file = item.getAsFile();
                        if (!file || file.size > 5 * 1024 * 1024) return;
                        const reader = new FileReader();
                        reader.onload = () => setChatImage(reader.result as string);
                        reader.readAsDataURL(file);
                        break;
                      }
                    }
                  }}
                  disabled={isChatLoading}
                  className="flex-1"
                />
                {isChatLoading ? (
                  <Button variant="destructive" onClick={() => chatAbortRef.current?.abort()} title="Parar">
                    <Square className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button onClick={handleChatSend} disabled={!chatInput.trim() && !chatImage}>
                    <Send className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Streaming */}
        {roboStatus === 'online' && serverUrl && (
          <div ref={streamingRef}>
            <RoboStreamViewer serverUrl={serverUrl} roboOnline={roboStatus === 'online'} />
          </div>
        )}

        {/* 4. Knowledge base - Learned sessions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                🎓 Conhecimento Aprendido
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowVideoUpload(true)}>
                  <FileVideo className="h-4 w-4 mr-1" /> Enviar Vídeo
                </Button>
                <Button variant="outline" size="sm" onClick={loadSessoes}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
                </Button>
              </div>
            </div>
            <CardDescription>
              Sessões gravadas e vídeos de treinamento. O conhecimento é usado automaticamente pelo agente IA.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sessoes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhuma sessão gravada ainda.</p>
                <p className="text-sm mt-1">Clique em "Gravar Sessão" para ensinar a IA como usar o CobMais.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome do Fluxo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Passos</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessoes.map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.nome}</TableCell>
                        <TableCell>
                          <Badge variant={s.status === 'concluida' ? 'default' : s.status === 'gravando' ? 'secondary' : 'destructive'}>
                            {s.status === 'concluida' ? '✅ Concluída' : s.status === 'gravando' ? '🔴 Gravando' : s.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{s.total_passos}</TableCell>
                        <TableCell className="text-sm">{format(new Date(s.criado_em), 'dd/MM/yyyy HH:mm')}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleViewKnowledge(s.id)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteSession(s.id)} className="text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Knowledge detail view */}
                {viewingSessaoId && selectedSessaoKnowledge.length > 0 && (
                  <div className="mt-4">
                    <Label className="text-sm font-medium mb-2 block">
                      Passos gravados ({selectedSessaoKnowledge.length}):
                    </Label>
                    <ScrollArea className="h-64 rounded-md border p-3 bg-muted">
                      <div className="space-y-2">
                        {selectedSessaoKnowledge.map((step, i) => (
                          <div key={step.id || i} className="flex items-start gap-2 text-xs border-b border-border/50 pb-2">
                            <span className="text-muted-foreground shrink-0 font-mono w-6">{step.passo_numero}.</span>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                              {step.acao}
                            </Badge>
                            {step.seletor && <code className="text-primary text-[10px]">{step.seletor}</code>}
                            {step.valor && <span className="text-muted-foreground truncate max-w-[200px]">"{step.valor}"</span>}
                            {step.descricao_tela && <span className="text-muted-foreground italic truncate">{step.descricao_tela}</span>}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 5. Código do Robô */}
        <RoboCodeViewer />

        {/* 6. Fila & Logs */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Fila & Logs</CardTitle>
              <Button variant="outline" size="sm" onClick={() => { loadComandos(); loadLogs(); }}>
                <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="comandos">
              <TabsList>
                <TabsTrigger value="comandos">Comandos ({comandos.length})</TabsTrigger>
                <TabsTrigger value="logs">Logs ({logs.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="comandos">
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ação</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Tempo</TableHead>
                        <TableHead>Erro</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comandos.map(cmd => (
                        <TableRow key={cmd.id}>
                          <TableCell className="font-mono text-sm">{cmd.acao}</TableCell>
                          <TableCell>
                            <Badge variant={cmd.status === 'concluido' ? 'default' : cmd.status === 'erro' ? 'destructive' : 'secondary'}>
                              {cmd.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{cmd.tempo_execucao_ms ? `${cmd.tempo_execucao_ms}ms` : '-'}</TableCell>
                          <TableCell className="text-sm text-destructive max-w-[200px] truncate">{cmd.erro || '-'}</TableCell>
                          <TableCell className="text-sm">{format(new Date(cmd.criado_em), 'dd/MM HH:mm:ss')}</TableCell>
                        </TableRow>
                      ))}
                      {comandos.length === 0 && (
                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum comando executado</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </TabsContent>
              <TabsContent value="logs">
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Mensagem</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map(log => (
                        <TableRow key={log.id}>
                          <TableCell>
                            <Badge variant={log.tipo === 'sucesso' ? 'default' : log.tipo === 'erro' ? 'destructive' : 'secondary'}>
                              {log.tipo}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm max-w-[400px] truncate">{log.mensagem}</TableCell>
                          <TableCell className="text-sm">{format(new Date(log.criado_em), 'dd/MM HH:mm:ss')}</TableCell>
                        </TableRow>
                      ))}
                      {logs.length === 0 && (
                        <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Nenhum log registrado</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Record session dialog */}
      <Dialog open={showRecordDialog} onOpenChange={setShowRecordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gravar Nova Sessão</DialogTitle>
            <DialogDescription>
              Dê um nome para esta sessão de treinamento. Depois, execute as ações no CobMais e o robô irá aprender.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="sessionName">Nome da Sessão</Label>
              <Input
                id="sessionName"
                placeholder="Ex: Gerar boleto para cliente"
                value={newSessionName}
                onChange={e => setNewSessionName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRecordDialog(false)}>Cancelar</Button>
            <Button onClick={handleStartRecording} disabled={!newSessionName.trim()}>
              <Video className="h-4 w-4 mr-1" /> Iniciar Gravação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Video upload dialog */}
      <Dialog open={showVideoUpload} onOpenChange={setShowVideoUpload}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar Vídeo de Treinamento</DialogTitle>
            <DialogDescription>
              Grave um vídeo mostrando como usar o CobMais. A IA irá assistir e aprender.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="videoFile">Arquivo de Vídeo</Label>
              <Input
                id="videoFile"
                type="file"
                accept="video/*"
                onChange={e => setVideoFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="videoDesc">Descrição do Vídeo</Label>
              <Textarea
                id="videoDesc"
                placeholder="Ex: Como gerar boleto para cliente inadimplente"
                value={videoDescription}
                onChange={e => setVideoDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVideoUpload(false)}>Cancelar</Button>
            <Button onClick={handleVideoUpload} disabled={!videoFile || !videoDescription.trim() || isUploadingVideo}>
              {isUploadingVideo ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
