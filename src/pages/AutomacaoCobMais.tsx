import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
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
import { Bot, Settings, Play, Square, RefreshCw, Send, Loader2, Wifi, WifiOff, Terminal, List, Clock, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

const ACOES_DISPONIVEIS = [
  { value: 'gerar_boleto', label: '🎫 Gerar Boleto CobMais', params: ['cpf', 'valor_final', 'tipo_pagamento', 'parcelas'] },
  { value: 'buscar_cliente', label: 'Buscar Cliente', params: ['cpf'] },
  { value: 'criar_cobranca', label: 'Criar Cobrança', params: ['cpf', 'valor'] },
  { value: 'registrar_acordo', label: 'Registrar Acordo', params: ['cpf', 'valor', 'parcelas'] },
  { value: 'extrair_info', label: 'Extrair Informações', params: ['cpf'] },
  { value: 'login', label: 'Login no CobMais', params: [] },
  { value: 'status_navegador', label: 'Status do Navegador', params: [] },
];

export default function AutomacaoCobMais() {
  const [serverUrl, setServerUrl] = useState('');
  const [cobmaisEmail, setCobmaisEmail] = useState('');
  const [cobmaisSenha, setCobmaisSenha] = useState('');
  const [roboStatus, setRoboStatus] = useState<'online' | 'offline' | 'checking'>('offline');
  const [savingConfig, setSavingConfig] = useState(false);
  const [selectedAcao, setSelectedAcao] = useState('');
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [executing, setExecuting] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [comandos, setComandos] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [chatbotAtivo, setChatbotAtivo] = useState(true);
  const [togglingChatbot, setTogglingChatbot] = useState(false);

  const invokeFunction = useCallback(async (body: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Não autenticado');
    
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const res = await fetch(`https://${projectId}.supabase.co/functions/v1/automacao-cobmais`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });
    return res.json();
  }, []);

  const loadConfig = useCallback(async () => {
    const result = await invokeFunction({ action: 'get_config' });
    if (result?.config) {
      setServerUrl(result.config.server_url || '');
      setCobmaisEmail(result.config.cobmais_email || '');
      setCobmaisSenha(result.config.cobmais_senha || '');
    }
  }, [invokeFunction]);

  const checkStatus = useCallback(async () => {
    setRoboStatus('checking');
    try {
      const result = await invokeFunction({ action: 'status' });
      setRoboStatus(result?.status === 'online' ? 'online' : 'offline');
    } catch {
      setRoboStatus('offline');
    }
  }, [invokeFunction]);

  const loadComandos = useCallback(async () => {
    const { data } = await supabase
      .from('automacao_comandos')
      .select('*')
      .order('criado_em', { ascending: false })
      .limit(50);
    if (data) setComandos(data);
  }, []);

  const loadLogs = useCallback(async () => {
    const { data } = await supabase
      .from('automacao_logs')
      .select('*')
      .order('criado_em', { ascending: false })
      .limit(100);
    if (data) setLogs(data);
  }, []);

  useEffect(() => {
    loadConfig();
    loadComandos();
    loadLogs();
  }, [loadConfig, loadComandos, loadLogs]);

  useEffect(() => {
    if (!serverUrl) return;
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, [serverUrl, checkStatus]);

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await invokeFunction({ action: 'save_config', server_url: serverUrl, cobmais_email: cobmaisEmail, cobmais_senha: cobmaisSenha });
      toast.success('Configuração salva');
    } catch {
      toast.error('Erro ao salvar configuração');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleExecute = async () => {
    if (!selectedAcao) return toast.error('Selecione uma ação');
    setExecuting(true);
    setLastResult(null);
    try {
      const result = await invokeFunction({ action: 'execute', acao: selectedAcao, parametros: paramValues });
      setLastResult(result);
      if (result.success) {
        toast.success(`Ação "${selectedAcao}" executada com sucesso`);
      } else {
        toast.error(result.error || 'Erro na execução');
      }
      loadComandos();
      loadLogs();
    } catch {
      toast.error('Erro ao executar comando');
    } finally {
      setExecuting(false);
    }
  };

  const currentParams = ACOES_DISPONIVEIS.find(a => a.value === selectedAcao)?.params || [];

  const statusColor = roboStatus === 'online' ? 'bg-green-500' : roboStatus === 'checking' ? 'bg-yellow-500' : 'bg-destructive';

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Bot className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Robô CobMais</h1>
            <p className="text-muted-foreground">Automação de tarefas no CobMais via Playwright</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className={`h-3 w-3 rounded-full ${statusColor} animate-pulse`} />
            <span className="text-sm font-medium capitalize">{roboStatus === 'checking' ? 'Verificando...' : roboStatus}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                {roboStatus === 'online' ? <Wifi className="h-4 w-4 text-green-500" /> : <WifiOff className="h-4 w-4 text-destructive" />}
                Status do Robô
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={roboStatus === 'online' ? 'default' : 'destructive'} className="text-lg px-4 py-1">
                {roboStatus === 'checking' ? 'Verificando...' : roboStatus === 'online' ? 'ONLINE' : 'OFFLINE'}
              </Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><List className="h-4 w-4" />Comandos Executados</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold">{comandos.length}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" />Último Comando</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-sm text-muted-foreground">
                {comandos[0] ? format(new Date(comandos[0].criado_em), 'dd/MM/yyyy HH:mm') : 'Nenhum'}
              </span>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Config */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" />Configuração</CardTitle>
              <CardDescription>URL do servidor Playwright e credenciais CobMais</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>URL do Servidor Playwright</Label>
                <Input placeholder="https://meurobo.ngrok.app" value={serverUrl} onChange={e => setServerUrl(e.target.value)} />
              </div>
              <Separator />
              <div>
              <Label>Login CobMais</Label>
                <Input placeholder="seu.usuario" value={cobmaisEmail} onChange={e => setCobmaisEmail(e.target.value)} />
              </div>
              <div>
                <Label>Senha CobMais</Label>
                <Input type="password" value={cobmaisSenha} onChange={e => setCobmaisSenha(e.target.value)} />
              </div>
              <Button onClick={handleSaveConfig} disabled={savingConfig} className="w-full">
                {savingConfig ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Salvar Configuração
              </Button>
            </CardContent>
          </Card>

          {/* Console */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Terminal className="h-5 w-5" />Console de Comandos</CardTitle>
              <CardDescription>Envie comandos para o robô CobMais</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Ação</Label>
                <Select value={selectedAcao} onValueChange={v => { setSelectedAcao(v); setParamValues({}); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma ação" /></SelectTrigger>
                  <SelectContent>
                    {ACOES_DISPONIVEIS.map(a => (
                      <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {currentParams.map(param => (
                <div key={param}>
                  <Label className="capitalize">{param}</Label>
                  <Input
                    placeholder={param === 'cpf' ? '000.000.000-00' : param === 'valor' ? '1500.00' : param}
                    value={paramValues[param] || ''}
                    onChange={e => setParamValues(prev => ({ ...prev, [param]: e.target.value }))}
                  />
                </div>
              ))}
              <Button onClick={handleExecute} disabled={executing || !selectedAcao || roboStatus !== 'online'} className="w-full">
                {executing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Executar
              </Button>
              {roboStatus !== 'online' && selectedAcao && (
                <p className="text-sm text-destructive">O robô precisa estar online para executar comandos.</p>
              )}
              {lastResult && (
                <div className="mt-2">
                  <Label>Resultado:</Label>
                  <ScrollArea className="h-32 rounded-md border p-3 bg-muted">
                    <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(lastResult, null, 2)}</pre>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Fila & Logs */}
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
    </AppLayout>
  );
}
