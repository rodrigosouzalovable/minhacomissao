import { useState, useRef, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useAutoSend } from '@/hooks/useAutoSend';
import type { UazapiInstance } from '@/hooks/useAutoSend';
import { Upload, Save, Check, X, Loader2, Trash2, FileSpreadsheet, Play, Square, Settings, Wifi, Send, Plus, Pencil } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ClienteData {
  cpf: string;
  nome: string;
  telefone: string;
  atraso: string;
  saldo: number;
}

interface HistoricoItem {
  id: string;
  nomeArquivo: string;
  qtdClientes: number;
  dataImportacao: string;
  clientes: ClienteData[];
}

type SendStatus = 'idle' | 'sending' | 'success' | 'error';

const getKey = (base: string, userId: string) => `${base}_${userId}`;
const MENSAGENS_BASE = 'acionamento_mensagens_salvas';
const HISTORICO_BASE = 'acionamento_historico';
const ACTIVE_BASE = 'acionamento_ativo';
const SEND_STATUS_BASE = 'acionamento_send_status';
const MANUAL_CHECKED_BASE = 'acionamento_manual_checked';
const SEND_TIMESTAMPS_BASE = 'acionamento_send_timestamps';
const AUTO_SENDING_BASE = 'acionamento_auto_sending_state';

const isToday = (isoString: string): boolean => {
  const date = new Date(isoString);
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
};

const formatPrimeiroNome = (nome: string): string => {
  const primeiro = nome.trim().split(/\s+/)[0].toLowerCase();
  return primeiro.charAt(0).toUpperCase() + primeiro.slice(1);
};

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const replaceVariables = (template: string, cliente: ClienteData): string =>
  template
    .replace(/\{nome\}/g, cliente.nome)
    .replace(/\{primeiro_nome\}/g, formatPrimeiroNome(cliente.nome))
    .replace(/\{cpf\}/g, cliente.cpf)
    .replace(/\{atraso\}/g, String(cliente.atraso))
    .replace(/\{saldo\}/g, formatCurrency(cliente.saldo));

const variables = [
  { key: '{nome}', label: 'Nome completo' },
  { key: '{primeiro_nome}', label: 'Primeiro nome (capitalizado)' },
  { key: '{cpf}', label: 'CPF' },
  { key: '{atraso}', label: 'Atraso (dias)' },
  { key: '{saldo}', label: 'Saldo (R$)' },
];

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

interface InstanceFormData {
  id?: string;
  nome: string;
  server_url: string;
  instance_token: string;
}

export default function Acionamento() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [clientes, setClientes] = useState<ClienteData[]>([]);
  const [mensagem, setMensagem] = useState('');
  const [mensagensSalvas, setMensagensSalvas] = useState<string[]>([]);
  const [lastUsedMsgIndex, setLastUsedMsgIndex] = useState<number | null>(null);
  const [sendStatus, setSendStatus] = useState<Record<number, SendStatus>>({});
  const [manualChecked, setManualChecked] = useState<Set<number>>(new Set());
  const [sendTimestamps, setSendTimestamps] = useState<Record<number, string>>({});
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [activeHistoricoId, setActiveHistoricoId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pendentes' | 'enviados'>('pendentes');
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  
  // Multi-instance UAZAPI state
  const [instances, setInstances] = useState<Array<{ id: string; nome: string; server_url: string; instance_token: string; ativo: boolean }>>([]);
  const [editingInstance, setEditingInstance] = useState<InstanceFormData | null>(null);
  const [savingInstance, setSavingInstance] = useState(false);
  const [testingInstanceId, setTestingInstanceId] = useState<string | null>(null);

  const [autoMinSec, setAutoMinSec] = useState(10);
  const [autoMaxSec, setAutoMaxSec] = useState(30);
  const activeHistoricoIdRef = useRef<string | null>(null);
  const { autoSending, autoProgress, sendStatus: contextSendStatus, sendTimestamps: contextSendTimestamps, startAutoSend, stopAutoSend } = useAutoSend();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uid = user?.id || '';
  const MENSAGENS_KEY = getKey(MENSAGENS_BASE, uid);
  const HISTORICO_KEY = getKey(HISTORICO_BASE, uid);
  const ACTIVE_KEY = getKey(ACTIVE_BASE, uid);
  const SEND_STATUS_KEY = getKey(SEND_STATUS_BASE, uid);
  const MANUAL_CHECKED_KEY = getKey(MANUAL_CHECKED_BASE, uid);
  const SEND_TIMESTAMPS_KEY = getKey(SEND_TIMESTAMPS_BASE, uid);
  const AUTO_SENDING_KEY = getKey(AUTO_SENDING_BASE, uid);

  useEffect(() => {
    activeHistoricoIdRef.current = activeHistoricoId;
  }, [activeHistoricoId]);

  // Load saved data
  useEffect(() => {
    if (!user) return;
    const savedMsgs = localStorage.getItem(MENSAGENS_KEY);
    if (savedMsgs) {
      try { setMensagensSalvas(JSON.parse(savedMsgs)); } catch {}
    }
    const savedHist = localStorage.getItem(HISTORICO_KEY);
    let parsedHist: HistoricoItem[] = [];
    if (savedHist) {
      try { parsedHist = JSON.parse(savedHist); setHistorico(parsedHist); } catch {}
    }
    const savedActiveId = localStorage.getItem(ACTIVE_KEY);
    if (savedActiveId && parsedHist.length > 0) {
      const activeItem = parsedHist.find(h => h.id === savedActiveId);
      if (activeItem) {
        setClientes(activeItem.clientes);
        setActiveHistoricoId(savedActiveId);
        const savedStatus = localStorage.getItem(`${SEND_STATUS_KEY}_${savedActiveId}`);
        if (savedStatus) {
          try { setSendStatus(JSON.parse(savedStatus)); } catch {}
        }
        const savedManual = localStorage.getItem(`${MANUAL_CHECKED_KEY}_${savedActiveId}`);
        if (savedManual) {
          try { setManualChecked(new Set(JSON.parse(savedManual))); } catch {}
        }
        const savedTs = localStorage.getItem(`${SEND_TIMESTAMPS_KEY}_${savedActiveId}`);
        if (savedTs) {
          try { setSendTimestamps(JSON.parse(savedTs)); } catch {}
        }
      }
    }
    localStorage.removeItem(AUTO_SENDING_KEY);
  }, [user]);

  // Fetch UAZAPI instances from database
  useEffect(() => {
    if (!user) return;
    const fetchInstances = async () => {
      const { data } = await supabase
        .from('user_whatsapp_instances' as any)
        .select('id, nome, server_url, instance_token, ativo')
        .eq('user_id', user.id)
        .order('criado_em', { ascending: true });
      if (data) {
        setInstances(data as any);
      }
    };
    fetchInstances();
  }, [user]);

  const activeInstances = useMemo(() => instances.filter(i => i.ativo), [instances]);

  const saveManualChecked = (checked: Set<number>) => {
    setManualChecked(checked);
    if (activeHistoricoId) {
      localStorage.setItem(`${MANUAL_CHECKED_KEY}_${activeHistoricoId}`, JSON.stringify([...checked]));
    }
  };

  const saveSendTimestamps = (timestamps: Record<number, string>) => {
    setSendTimestamps(timestamps);
    if (activeHistoricoId) {
      localStorage.setItem(`${SEND_TIMESTAMPS_KEY}_${activeHistoricoId}`, JSON.stringify(timestamps));
    }
  };

  const saveHistorico = (items: HistoricoItem[]) => {
    setHistorico(items);
    localStorage.setItem(HISTORICO_KEY, JSON.stringify(items));
  };

  const saveMensagens = (msgs: string[]) => {
    setMensagensSalvas(msgs);
    localStorage.setItem(MENSAGENS_KEY, JSON.stringify(msgs));
  };

  const handleSaveMessage = () => {
    if (!mensagem.trim()) {
      toast.error('Digite uma mensagem antes de salvar');
      return;
    }
    saveMensagens([...mensagensSalvas, mensagem.trim()]);
    setMensagem('');
    toast.success('Mensagem salva!');
  };

  const handleDeleteMessage = (index: number) => {
    const updated = mensagensSalvas.filter((_, i) => i !== index);
    saveMensagens(updated);
    if (lastUsedMsgIndex !== null) {
      if (index === lastUsedMsgIndex) setLastUsedMsgIndex(null);
      else if (index < lastUsedMsgIndex) setLastUsedMsgIndex(lastUsedMsgIndex - 1);
    }
    toast.success('Mensagem removida');
  };

  const insertVariable = (variable: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = mensagem.slice(0, start) + variable + mensagem.slice(end);
    setMensagem(newValue);
    setTimeout(() => {
      textarea.focus();
      const pos = start + variable.length;
      textarea.setSelectionRange(pos, pos);
    }, 0);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileName = file.name;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      const parsed: ClienteData[] = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 5) continue;
        const telefone = String(row[2] ?? '').replace(/\D/g, '');
        if (!telefone) continue;
        parsed.push({
          cpf: String(row[0] ?? ''),
          nome: String(row[1] ?? ''),
          telefone,
          atraso: String(row[3] ?? ''),
          saldo: Number(row[4]) || 0,
        });
      }

      setClientes(parsed);
      setSendStatus({});
      setManualChecked(new Set());
      setSendTimestamps({});

      const newItem: HistoricoItem = {
        id: crypto.randomUUID(),
        nomeArquivo: fileName,
        qtdClientes: parsed.length,
        dataImportacao: new Date().toISOString(),
        clientes: parsed,
      };
      setActiveHistoricoId(newItem.id);
      localStorage.setItem(ACTIVE_KEY, newItem.id);
      localStorage.removeItem(`${SEND_STATUS_KEY}_${newItem.id}`);
      localStorage.removeItem(`${MANUAL_CHECKED_KEY}_${newItem.id}`);
      localStorage.removeItem(`${SEND_TIMESTAMPS_KEY}_${newItem.id}`);
      saveHistorico([newItem, ...historico]);
      toast.success(`${parsed.length} clientes importados`);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleLoadHistorico = (item: HistoricoItem) => {
    setClientes(item.clientes);
    setActiveHistoricoId(item.id);
    localStorage.setItem(ACTIVE_KEY, item.id);
    const savedStatus = localStorage.getItem(`${SEND_STATUS_KEY}_${item.id}`);
    if (savedStatus) {
      try { setSendStatus(JSON.parse(savedStatus)); } catch { setSendStatus({}); }
    } else {
      setSendStatus({});
    }
    const savedManual = localStorage.getItem(`${MANUAL_CHECKED_KEY}_${item.id}`);
    if (savedManual) {
      try { setManualChecked(new Set(JSON.parse(savedManual))); } catch { setManualChecked(new Set()); }
    } else {
      setManualChecked(new Set());
    }
    const savedTs = localStorage.getItem(`${SEND_TIMESTAMPS_KEY}_${item.id}`);
    if (savedTs) {
      try { setSendTimestamps(JSON.parse(savedTs)); } catch { setSendTimestamps({}); }
    } else {
      setSendTimestamps({});
    }
    toast.success(`Planilha "${item.nomeArquivo}" carregada`);
  };

  const handleDeleteHistorico = (id: string) => {
    const updated = historico.filter((h) => h.id !== id);
    saveHistorico(updated);
    localStorage.removeItem(`${SEND_STATUS_KEY}_${id}`);
    localStorage.removeItem(`${MANUAL_CHECKED_KEY}_${id}`);
    localStorage.removeItem(`${SEND_TIMESTAMPS_KEY}_${id}`);
    if (activeHistoricoId === id) {
      setClientes([]);
      setSendStatus({});
      setManualChecked(new Set());
      setSendTimestamps({});
      setActiveHistoricoId(null);
      localStorage.removeItem(ACTIVE_KEY);
    }
    toast.success('Planilha removida do histórico');
  };

  const handleManualCheck = (originalIndex: number, checked: boolean) => {
    const next = new Set(manualChecked);
    if (checked) {
      next.add(originalIndex);
      const nextTs = { ...sendTimestamps, [originalIndex]: new Date().toISOString() };
      saveSendTimestamps(nextTs);
    } else {
      next.delete(originalIndex);
    }
    saveManualChecked(next);
  };

  const getRotatedMessage = (): string | null => {
    if (mensagensSalvas.length === 0) return null;
    if (mensagensSalvas.length === 1) { setLastUsedMsgIndex(0); return mensagensSalvas[0]; }
    let newIndex: number;
    do {
      newIndex = Math.floor(Math.random() * mensagensSalvas.length);
    } while (newIndex === lastUsedMsgIndex);
    setLastUsedMsgIndex(newIndex);
    return mensagensSalvas[newIndex];
  };

  const getFirstActiveConfig = (): UazapiInstance | null => {
    if (activeInstances.length > 0) {
      return { server_url: activeInstances[0].server_url, instance_token: activeInstances[0].instance_token, nome: activeInstances[0].nome };
    }
    return null;
  };

  const handleSend = async (index: number) => {
    const template = getRotatedMessage();
    if (!template) {
      toast.error('Salve pelo menos uma mensagem antes de enviar');
      return;
    }

    const cliente = clientes[index];
    setSendStatus((prev) => ({ ...prev, [index]: 'sending' }));

    try {
      const msg = replaceVariables(template, cliente);
      const body: any = { telefone: cliente.telefone, mensagem: msg };
      const config = getFirstActiveConfig();
      if (config) {
        body.uazapi_server_url = config.server_url;
        body.uazapi_instance_token = config.instance_token;
      }
      const { data, error } = await supabase.functions.invoke('send-whatsapp', { body });

      if (error || !data?.success) throw new Error(error?.message || data?.error || 'Erro');
      setSendStatus((prev) => {
        const next = { ...prev, [index]: 'success' as SendStatus };
        const hId = activeHistoricoIdRef.current;
        if (hId) localStorage.setItem(`${SEND_STATUS_KEY}_${hId}`, JSON.stringify(next));
        return next;
      });
      setSendTimestamps((prev) => {
        const next = { ...prev, [index]: new Date().toISOString() };
        const hId = activeHistoricoIdRef.current;
        if (hId) localStorage.setItem(`${SEND_TIMESTAMPS_KEY}_${hId}`, JSON.stringify(next));
        return next;
      });
      toast.success(`Mensagem enviada para ${formatPrimeiroNome(cliente.nome)}`);
    } catch (err: any) {
      setSendStatus((prev) => {
        const next = { ...prev, [index]: 'error' as SendStatus };
        const hId = activeHistoricoIdRef.current;
        if (hId) localStorage.setItem(`${SEND_STATUS_KEY}_${hId}`, JSON.stringify(next));
        return next;
      });
      toast.error(`Falha ao enviar para ${formatPrimeiroNome(cliente.nome)}: ${err.message}`);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  // Sync context sendStatus/sendTimestamps into local state when auto-sending
  useEffect(() => {
    if (autoSending) {
      setSendStatus(contextSendStatus);
    }
  }, [autoSending, contextSendStatus]);

  useEffect(() => {
    if (autoSending) {
      setSendTimestamps(contextSendTimestamps);
    }
  }, [autoSending, contextSendTimestamps]);

  // When auto-send finishes, switch to enviados tab
  const prevAutoSending = useRef(autoSending);
  useEffect(() => {
    if (prevAutoSending.current && !autoSending) {
      setActiveTab('enviados');
    }
    prevAutoSending.current = autoSending;
  }, [autoSending]);

  const handleAutoSend = () => {
    if (mensagensSalvas.length === 0) {
      toast.error('Salve pelo menos uma mensagem antes de iniciar');
      return;
    }
    if (autoMinSec < 1) {
      toast.error('O tempo mínimo deve ser pelo menos 1 segundo');
      return;
    }
    if (autoMaxSec <= autoMinSec) {
      toast.error('O tempo máximo deve ser maior que o mínimo');
      return;
    }

    // Build configs array from active instances
    const configs: UazapiInstance[] = activeInstances.map(i => ({
      server_url: i.server_url,
      instance_token: i.instance_token,
      nome: i.nome,
    }));

    startAutoSend({
      clientes,
      mensagensSalvas,
      uazapiConfigs: configs,
      minSec: autoMinSec,
      maxSec: autoMaxSec,
      historicoId: activeHistoricoId,
      userId: uid,
      existingStatus: sendStatus,
      existingChecked: manualChecked,
    });
  };

  const handleStopAutoSend = () => {
    stopAutoSend();
  };

  const clientesComIndex = useMemo(
    () => clientes.map((c, i) => ({ ...c, originalIndex: i })),
    [clientes]
  );

  const pendentes = useMemo(
    () => clientesComIndex.filter(c => sendStatus[c.originalIndex] !== 'success' && sendStatus[c.originalIndex] !== 'error' && !manualChecked.has(c.originalIndex)),
    [clientesComIndex, sendStatus, manualChecked]
  );

  const enviados = useMemo(
    () => clientesComIndex.filter(c => sendStatus[c.originalIndex] === 'success' || sendStatus[c.originalIndex] === 'error' || manualChecked.has(c.originalIndex)),
    [clientesComIndex, sendStatus, manualChecked]
  );

  const enviadosHoje = useMemo(
    () => enviados.filter(c => {
      const ts = sendTimestamps[c.originalIndex];
      return ts && isToday(ts);
    }).length,
    [enviados, sendTimestamps]
  );

  // Instance management
  const handleSaveInstance = async () => {
    if (!user || !editingInstance) return;
    if (!editingInstance.server_url.trim() || !editingInstance.instance_token.trim()) {
      toast.error('Preencha Server URL e Instance Token');
      return;
    }
    setSavingInstance(true);
    try {
      if (editingInstance.id) {
        // Update
        const { error } = await supabase
          .from('user_whatsapp_instances' as any)
          .update({
            nome: editingInstance.nome.trim() || null,
            server_url: editingInstance.server_url.trim(),
            instance_token: editingInstance.instance_token.trim(),
          } as any)
          .eq('id', editingInstance.id);
        if (error) throw error;
        setInstances(prev => prev.map(i => i.id === editingInstance.id ? { ...i, nome: editingInstance.nome.trim(), server_url: editingInstance.server_url.trim(), instance_token: editingInstance.instance_token.trim() } : i));
        toast.success('Instância atualizada!');
      } else {
        // Insert
        const { data, error } = await supabase
          .from('user_whatsapp_instances' as any)
          .insert({
            user_id: user.id,
            nome: editingInstance.nome.trim() || null,
            server_url: editingInstance.server_url.trim(),
            instance_token: editingInstance.instance_token.trim(),
          } as any)
          .select()
          .single();
        if (error) throw error;
        setInstances(prev => [...prev, data as any]);
        toast.success('WhatsApp adicionado!');
      }
      setEditingInstance(null);
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setSavingInstance(false);
    }
  };

  const handleDeleteInstance = async (id: string) => {
    const { error } = await supabase
      .from('user_whatsapp_instances' as any)
      .delete()
      .eq('id', id);
    if (error) {
      toast.error(`Erro ao remover: ${error.message}`);
      return;
    }
    setInstances(prev => prev.filter(i => i.id !== id));
    toast.success('Instância removida');
  };

  const handleToggleInstance = async (id: string, ativo: boolean) => {
    const { error } = await supabase
      .from('user_whatsapp_instances' as any)
      .update({ ativo } as any)
      .eq('id', id);
    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }
    setInstances(prev => prev.map(i => i.id === id ? { ...i, ativo } : i));
  };

  const handleTestInstance = async (instance: { id: string; server_url: string; instance_token: string }) => {
    setTestingInstanceId(instance.id);
    try {
      const { data, error } = await supabase.functions.invoke('test-uazapi-connection', {
        body: { server_url: instance.server_url, instance_token: instance.instance_token }
      });
      if (error) throw error;
      if (data?.ok) {
        toast.success(`Conexão bem-sucedida! (${data.endpoint})`);
      } else {
        const detail = data?.data?.message || data?.data?.error || data?.error || JSON.stringify(data?.data);
        toast.error(`Erro (status ${data?.status}): ${detail}`);
      }
    } catch (error: any) {
      toast.error(`Não foi possível conectar: ${error.message}`);
    } finally {
      setTestingInstanceId(null);
    }
  };

  const handleTestSend = async () => {
    if (!testPhone.trim()) {
      toast.error('Digite um número de telefone para teste');
      return;
    }
    setSendingTest(true);
    try {
      const body: any = { telefone: testPhone.trim(), mensagem: 'mensagem teste' };
      const config = getFirstActiveConfig();
      if (config) {
        body.uazapi_server_url = config.server_url;
        body.uazapi_instance_token = config.instance_token;
      }
      const { data, error } = await supabase.functions.invoke('send-whatsapp', { body });
      if (error || !data?.success) throw new Error(error?.message || data?.error || 'Erro ao enviar');
      toast.success('Mensagem de teste enviada com sucesso!');
    } catch (err: any) {
      toast.error(`Erro ao enviar teste: ${err.message}`);
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Acionamento</h1>

        {/* Upload + Histórico */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Importar Planilha</CardTitle>
            <div className="flex items-center gap-2">
              {!isAdmin && activeInstances.length > 0 && (
                <Badge variant="secondary">
                  {activeInstances.length} WhatsApp{activeInstances.length > 1 ? 's' : ''} ativo{activeInstances.length > 1 ? 's' : ''}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setConfigDialogOpen(true)}
                className="text-muted-foreground"
              >
                <Settings className="h-5 w-5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" /> Selecionar arquivo Excel
              </Button>
              {clientes.length > 0 && (
                <Badge variant="secondary">
                  {clientes.length} clientes importados
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Formato esperado: <strong>Coluna A</strong> = CPF, <strong>Coluna B</strong> = Nome, <strong>Coluna C</strong> = Telefone, <strong>Coluna D</strong> = Atraso, <strong>Coluna E</strong> = Saldo
            </p>

            {historico.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Histórico de importações</p>
                <div className="space-y-1">
                  {historico.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between rounded-md border p-2 cursor-pointer hover:bg-accent/50 transition-colors ${activeHistoricoId === item.id ? 'border-primary bg-accent/30' : ''}`}
                      onClick={() => handleLoadHistorico(item)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileSpreadsheet className="h-4 w-4 shrink-0 text-green-600" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{item.nomeArquivo}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.qtdClientes} clientes · {formatDate(item.dataImportacao)}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteHistorico(item.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mensagem */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Mensagens</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {variables.map((v) => (
                <Button
                  key={v.key}
                  variant="secondary"
                  size="sm"
                  onClick={() => insertVariable(v.key)}
                >
                  {v.key} <span className="ml-1 text-xs opacity-70">({v.label})</span>
                </Button>
              ))}
            </div>
            <Textarea
              ref={textareaRef}
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              placeholder="Digite a mensagem usando as variáveis acima..."
              rows={6}
            />
            <Button onClick={handleSaveMessage}>
              <Save className="h-4 w-4 mr-2" /> Salvar mensagem
            </Button>

            {mensagensSalvas.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Mensagens salvas ({mensagensSalvas.length})</p>
                <div className="space-y-1">
                  {mensagensSalvas.map((msg, i) => (
                    <div key={i} className="flex items-start justify-between gap-2 rounded-md border p-3">
                      <p className="text-sm whitespace-pre-wrap break-words min-w-0 flex-1">{msg}</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteMessage(i)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lista de clientes com abas */}
        {clientes.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Button
                  variant={activeTab === 'pendentes' ? 'default' : 'outline'}
                  onClick={() => setActiveTab('pendentes')}
                >
                  A ENVIAR ({pendentes.length})
                </Button>
                <Button
                  variant={activeTab === 'enviados' ? 'default' : 'outline'}
                  onClick={() => setActiveTab('enviados')}
                >
                  ENVIADOS ({enviadosHoje} hoje)
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeTab === 'pendentes' && (
                <div className="flex flex-wrap items-center gap-2 rounded-md border p-3 bg-muted/30">
                  <span className="text-sm font-medium">Envio automático:</span>
                  <Input
                    type="number"
                    min={1}
                    value={autoMinSec}
                    onChange={(e) => setAutoMinSec(Number(e.target.value))}
                    className="w-20 h-9"
                    disabled={autoSending}
                  />
                  <span className="text-sm">a</span>
                  <Input
                    type="number"
                    min={2}
                    value={autoMaxSec}
                    onChange={(e) => setAutoMaxSec(Number(e.target.value))}
                    className="w-20 h-9"
                    disabled={autoSending}
                  />
                  <span className="text-sm">segundos</span>
                  {!autoSending ? (
                    <Button
                      size="sm"
                      onClick={handleAutoSend}
                      disabled={mensagensSalvas.length === 0 || pendentes.length === 0}
                      className="bg-green-600 hover:bg-green-700 text-primary-foreground"
                    >
                      <Play className="h-4 w-4 mr-1" /> Iniciar
                    </Button>
                  ) : (
                    <>
                      {autoProgress && (
                        <span className="text-sm font-medium text-muted-foreground">
                          Enviando {autoProgress.current}/{autoProgress.total}...
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleStopAutoSend}
                      >
                        <Square className="h-4 w-4 mr-1" /> Parar
                      </Button>
                    </>
                  )}
                </div>
              )}
              {activeTab === 'pendentes' && (
                <>
                  {pendentes.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum cliente pendente</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Telefone</TableHead>
                          <TableHead>Atraso</TableHead>
                          <TableHead>Saldo</TableHead>
                          <TableHead className="w-24 text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendentes.map((c) => (
                          <TableRow key={c.originalIndex}>
                            <TableCell className="font-medium">{c.nome}</TableCell>
                            <TableCell>{c.telefone}</TableCell>
                            <TableCell>{c.atraso}</TableCell>
                            <TableCell>{formatCurrency(c.saldo)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Checkbox
                                  checked={false}
                                  onCheckedChange={(checked) => handleManualCheck(c.originalIndex, !!checked)}
                                  disabled={autoSending}
                                />
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  disabled={sendStatus[c.originalIndex] === 'sending' || autoSending}
                                  onClick={() => handleSend(c.originalIndex)}
                                  className={
                                    sendStatus[c.originalIndex] === 'error'
                                      ? 'text-destructive'
                                      : 'text-green-600 hover:text-green-700'
                                  }
                                >
                                  {sendStatus[c.originalIndex] === 'sending' ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                  ) : sendStatus[c.originalIndex] === 'error' ? (
                                    <X className="h-5 w-5" />
                                  ) : (
                                    <WhatsAppIcon />
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </>
              )}

              {activeTab === 'enviados' && (
                <>
                  {enviados.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhuma mensagem enviada ainda</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Telefone</TableHead>
                          <TableHead>Atraso</TableHead>
                          <TableHead>Saldo</TableHead>
                          <TableHead className="w-24 text-right">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {enviados.map((c) => {
                          const wasSent = sendStatus[c.originalIndex] === 'success';
                          const wasError = sendStatus[c.originalIndex] === 'error';
                          const wasManual = manualChecked.has(c.originalIndex);
                          return (
                            <TableRow key={c.originalIndex}>
                              <TableCell className="font-medium">{c.nome}</TableCell>
                              <TableCell>{c.telefone}</TableCell>
                              <TableCell>{c.atraso}</TableCell>
                              <TableCell>{formatCurrency(c.saldo)}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {wasSent && (
                                    <Badge variant="default" className="bg-green-600 hover:bg-green-600">
                                      <Check className="h-3 w-3 mr-1" /> Enviado
                                    </Badge>
                                  )}
                                  {wasError && (
                                    <Badge variant="destructive">
                                      <X className="h-3 w-3 mr-1" /> Erro
                                    </Badge>
                                  )}
                                  {wasManual && !wasSent && !wasError && (
                                    <div className="flex items-center gap-2">
                                      <Badge variant="secondary">Manual</Badge>
                                      <Checkbox
                                        checked={true}
                                        onCheckedChange={(checked) => handleManualCheck(c.originalIndex, !!checked)}
                                      />
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Config Dialog */}
        <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Configurações WhatsApp</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {isAdmin && (
                <div className="rounded-md border p-4 bg-muted/30">
                  <p className="text-sm text-muted-foreground">
                    Sua conta de administrador também utiliza a <strong>Z-API</strong> configurada no sistema como fallback. Caso não tenha instâncias UAZAPI ativas, o envio será feito pela Z-API.
                  </p>
                  <Badge variant="default" className="mt-2">Z-API (Padrão do sistema)</Badge>
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold">Instâncias UAZAPI</h3>
                    <p className="text-sm text-muted-foreground">
                      Cadastre múltiplos WhatsApps para rotação automática dos envios.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setEditingInstance({ nome: '', server_url: '', instance_token: '' })}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Adicionar
                  </Button>
                </div>

                  {/* Instance form (add/edit) */}
                  {editingInstance && (
                    <div className="rounded-md border p-4 space-y-3 bg-muted/20">
                      <h4 className="text-sm font-semibold">{editingInstance.id ? 'Editar instância' : 'Nova instância'}</h4>
                      <div className="space-y-2">
                        <Label>Nome (opcional)</Label>
                        <Input
                          placeholder="Ex: WhatsApp X"
                          value={editingInstance.nome}
                          onChange={(e) => setEditingInstance({ ...editingInstance, nome: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Server URL</Label>
                        <Input
                          placeholder="https://certificadoracnpj.uazapi.com"
                          value={editingInstance.server_url}
                          onChange={(e) => setEditingInstance({ ...editingInstance, server_url: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Instance Token</Label>
                        <Input
                          placeholder="c01095d6-64d4-4b33-9c1f-86a09948dc7c"
                          value={editingInstance.instance_token}
                          onChange={(e) => setEditingInstance({ ...editingInstance, instance_token: e.target.value })}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleSaveInstance} disabled={savingInstance} size="sm">
                          {savingInstance ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                          Salvar
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setEditingInstance(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Instances list */}
                  {instances.length === 0 && !editingInstance && (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhuma instância cadastrada</p>
                  )}
                  {instances.map((inst) => (
                    <div key={inst.id} className={`flex items-center gap-3 rounded-md border px-3 py-2 ${inst.ativo ? '' : 'opacity-50'}`}>
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <WhatsAppIcon />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-sm truncate">{inst.nome || 'Sem nome'}</span>
                            <Badge variant={inst.ativo ? "default" : "secondary"} className="text-[10px] px-1.5 py-0 shrink-0">
                              {inst.ativo ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">{inst.server_url}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Switch
                          checked={inst.ativo}
                          onCheckedChange={(checked) => handleToggleInstance(inst.id, checked)}
                          className="scale-90"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleTestInstance(inst)}
                          disabled={testingInstanceId === inst.id}
                          title="Testar conexão"
                        >
                          {testingInstanceId === inst.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setEditingInstance({ id: inst.id, nome: inst.nome, server_url: inst.server_url, instance_token: inst.instance_token })}
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteInstance(inst.id)}
                          title="Remover"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-base font-semibold">Testar envio</h3>
                <div className="space-y-2">
                  <Label htmlFor="test-phone">Telefone para teste</Label>
                  <Input
                    id="test-phone"
                    placeholder="11999999999"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                  />
                </div>
                <Button onClick={handleTestSend} disabled={sendingTest || !testPhone.trim()}>
                  {sendingTest ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  Testar envio
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
