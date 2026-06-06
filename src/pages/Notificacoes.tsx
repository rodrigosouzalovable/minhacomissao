import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bell, QrCode, Save, RefreshCw, Loader2, Send, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';

interface Operador {
  id: string;
  nome: string;
  email: string;
}

interface TelefoneRow {
  user_id: string;
  telefone: string;
  ativo: boolean;
}

export default function Notificacoes() {
  const qc = useQueryClient();
  const [selectedInstance, setSelectedInstance] = useState<string>('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrConnected, setQrConnected] = useState(false);
  const [creatingInstance, setCreatingInstance] = useState(false);
  const [edits, setEdits] = useState<Record<string, { telefone: string; ativo: boolean }>>({});
  const [testingRun, setTestingRun] = useState(false);

  // Todas as instâncias (para permitir reconectar inativas também)
  const { data: instances, refetch: refetchInstances } = useQuery({
    queryKey: ['notif-instancias'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_whatsapp_instances')
        .select('id, nome, telefone, ativo, server_url, instance_token')
        .order('criado_em', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: config, refetch: refetchConfig } = useQuery({
    queryKey: ['notif-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notificacoes_config')
        .select('*')
        .order('atualizado_em', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (config?.instancia_id) setSelectedInstance(config.instancia_id);
  }, [config]);

  // Operadores
  const { data: operadores } = useQuery<Operador[]>({
    queryKey: ['notif-operadores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome, email')
        .order('nome');
      if (error) throw error;
      return (data as any) || [];
    },
  });

  const { data: telefones, refetch: refetchTelefones } = useQuery<TelefoneRow[]>({
    queryKey: ['notif-telefones'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notificacoes_operador_telefone')
        .select('user_id, telefone, ativo');
      if (error) throw error;
      return (data as any) || [];
    },
  });

  const { data: logs, refetch: refetchLogs } = useQuery({
    queryKey: ['notif-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notificacoes_envios_log')
        .select('id, pagamento_id, user_id, tipo, data_ref, telefone, sucesso, erro, enviado_em')
        .order('enviado_em', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const telMap = new Map((telefones || []).map(t => [t.user_id, t]));

  const handleSaveConfig = async () => {
    if (!selectedInstance) {
      toast.error('Selecione uma instância');
      return;
    }
    setSavingConfig(true);
    try {
      if (config?.id) {
        const { error } = await supabase
          .from('notificacoes_config')
          .update({ instancia_id: selectedInstance, ativo: true })
          .eq('id', config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('notificacoes_config')
          .insert({ instancia_id: selectedInstance, ativo: true });
        if (error) throw error;
      }
      toast.success('Instância configurada');
      refetchConfig();
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + e.message);
    } finally {
      setSavingConfig(false);
    }
  };

  const openQr = async () => {
    if (!selectedInstance) {
      toast.error('Selecione uma instância primeiro');
      return;
    }
    setQrOpen(true);
    setQrLoading(true);
    setQrImage(null);
    try {
      const inst = instances?.find(i => i.id === selectedInstance);
      if (!inst) throw new Error('Instância não encontrada');
      const { data, error } = await supabase.functions.invoke('whatsapp-qr', {
        body: { action: 'qr', instanceId: selectedInstance, userId: 'admin' },
      });
      if (error) throw error;
      const img = data?.qrcode || data?.qr || data?.base64 || null;
      if (img) {
        setQrImage(img.startsWith('data:') ? img : `data:image/png;base64,${img}`);
      } else if (data?.status === 'connected') {
        toast.success('Já conectado!');
        setQrOpen(false);
      } else {
        toast.message('Sem QR disponível', { description: 'Tente novamente em alguns segundos.' });
      }
    } catch (e: any) {
      toast.error('Erro ao gerar QR: ' + e.message);
    } finally {
      setQrLoading(false);
    }
  };

  const handleSaveTelefone = async (userId: string) => {
    const edit = edits[userId];
    const current = telMap.get(userId);
    const telefone = edit?.telefone ?? current?.telefone ?? '';
    const ativo = edit?.ativo ?? current?.ativo ?? true;
    const digits = telefone.replace(/\D/g, '');
    if (digits.length < 10) {
      toast.error('Telefone inválido');
      return;
    }
    try {
      if (current) {
        const { error } = await supabase
          .from('notificacoes_operador_telefone')
          .update({ telefone: digits, ativo })
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('notificacoes_operador_telefone')
          .insert({ user_id: userId, telefone: digits, ativo });
        if (error) throw error;
      }
      toast.success('Salvo');
      setEdits(prev => { const n = { ...prev }; delete n[userId]; return n; });
      refetchTelefones();
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + e.message);
    }
  };

  const handleTestRun = async (tipo: 'D-1' | 'D0') => {
    setTestingRun(true);
    try {
      const { data, error } = await supabase.functions.invoke('notificar-boletos-pendentes', {
        body: { tipo },
      });
      if (error) throw error;
      toast.success(`Execução ${tipo}: ${data?.total ?? 0} parcelas processadas`);
      refetchLogs();
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    } finally {
      setTestingRun(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Notificações</h1>
            <p className="text-sm text-muted-foreground">
              Lembretes automáticos via WhatsApp para operadores enviarem boletos.
              Disparos: 14h do dia anterior + 9h do dia do vencimento (até marcar como enviado).
            </p>
          </div>
        </div>

        {/* WhatsApp Notificador */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">WhatsApp Notificador</CardTitle>
            <CardDescription>
              Selecione e conecte o número que enviará os lembretes internos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 max-w-md">
              <Label>Instância</Label>
              <Select value={selectedInstance} onValueChange={setSelectedInstance}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma instância" />
                </SelectTrigger>
                <SelectContent>
                  {(instances || []).map(i => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.nome || i.telefone || i.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={handleSaveConfig} disabled={savingConfig || !selectedInstance}>
                {savingConfig ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                Salvar configuração
              </Button>
              <Button variant="outline" onClick={openQr} disabled={!selectedInstance}>
                <QrCode className="h-4 w-4 mr-1" /> Conectar via QR Code
              </Button>
              <Button variant="outline" onClick={() => handleTestRun('D-1')} disabled={testingRun}>
                <Send className="h-4 w-4 mr-1" /> Testar D-1
              </Button>
              <Button variant="outline" onClick={() => handleTestRun('D0')} disabled={testingRun}>
                <Send className="h-4 w-4 mr-1" /> Testar D0
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Telefones dos operadores */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Telefones dos Operadores</CardTitle>
            <CardDescription>
              Número que receberá o lembrete quando houver acordo com boleto não enviado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Operador</TableHead>
                    <TableHead>Telefone (DDD + número)</TableHead>
                    <TableHead className="w-24">Ativo</TableHead>
                    <TableHead className="w-32">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(operadores || []).map(op => {
                    const cur = telMap.get(op.id);
                    const edit = edits[op.id];
                    const tel = edit?.telefone ?? cur?.telefone ?? '';
                    const ativo = edit?.ativo ?? cur?.ativo ?? true;
                    const dirty = !!edit;
                    return (
                      <TableRow key={op.id}>
                        <TableCell>
                          <div className="font-medium">{op.nome}</div>
                          <div className="text-xs text-muted-foreground">{op.email}</div>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={tel}
                            onChange={e => setEdits(p => ({ ...p, [op.id]: { telefone: e.target.value, ativo } }))}
                            placeholder="Ex: 62999999999"
                          />
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={ativo}
                            onCheckedChange={v => setEdits(p => ({ ...p, [op.id]: { telefone: tel, ativo: v } }))}
                          />
                        </TableCell>
                        <TableCell>
                          <Button size="sm" disabled={!dirty} onClick={() => handleSaveTelefone(op.id)}>
                            <Save className="h-3 w-3 mr-1" /> Salvar
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Histórico */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Histórico recente</CardTitle>
              <CardDescription>Últimos 50 envios.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => refetchLogs()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Operador</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(logs || []).map((l: any) => {
                    const op = operadores?.find(o => o.id === l.user_id);
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs">
                          {format(new Date(l.enviado_em), 'dd/MM HH:mm')}
                        </TableCell>
                        <TableCell><Badge variant="outline">{l.tipo}</Badge></TableCell>
                        <TableCell className="text-sm">{op?.nome || l.user_id.slice(0, 8)}</TableCell>
                        <TableCell className="text-sm">{l.telefone}</TableCell>
                        <TableCell>
                          {l.sucesso ? (
                            <Badge className="bg-emerald-600"><CheckCircle2 className="h-3 w-3 mr-1" /> OK</Badge>
                          ) : (
                            <Badge variant="destructive" title={l.erro || ''}><XCircle className="h-3 w-3 mr-1" /> Erro</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(!logs || logs.length === 0) && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhum envio ainda.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            {qrLoading && <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />}
            {qrImage && <img src={qrImage} alt="QR Code" className="w-64 h-64" />}
            <p className="text-xs text-muted-foreground text-center">
              Abra o WhatsApp no celular → Aparelhos conectados → Conectar um aparelho.
            </p>
            <Button variant="outline" size="sm" onClick={openQr}>
              <RefreshCw className="h-4 w-4 mr-1" /> Atualizar QR
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
