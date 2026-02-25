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
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Upload, Save, Check, X, Loader2, Trash2, FileSpreadsheet, Play, Square, Settings, Wifi, Send } from 'lucide-react';
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
  
  // UAZAPI config state
  const [uazapiServerUrl, setUazapiServerUrl] = useState('');
  const [uazapiInstanceToken, setUazapiInstanceToken] = useState('');
  const [uazapiConfigured, setUazapiConfigured] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const uazapiConfigRef = useRef<{ server_url: string; instance_token: string } | null>(null);
  const [autoMinSec, setAutoMinSec] = useState(10);
  const [autoMaxSec, setAutoMaxSec] = useState(30);
  const [autoSending, setAutoSending] = useState(false);
  const [autoProgress, setAutoProgress] = useState<{ current: number; total: number } | null>(null);
  const autoSendingRef = useRef(false);
  const activeHistoricoIdRef = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // User-scoped localStorage keys
  const uid = user?.id || '';
  const MENSAGENS_KEY = getKey(MENSAGENS_BASE, uid);
  const HISTORICO_KEY = getKey(HISTORICO_BASE, uid);
  const ACTIVE_KEY = getKey(ACTIVE_BASE, uid);
  const SEND_STATUS_KEY = getKey(SEND_STATUS_BASE, uid);
  const MANUAL_CHECKED_KEY = getKey(MANUAL_CHECKED_BASE, uid);
  const SEND_TIMESTAMPS_KEY = getKey(SEND_TIMESTAMPS_BASE, uid);
  const AUTO_SENDING_KEY = getKey(AUTO_SENDING_BASE, uid);

  // Keep ref in sync with state
  useEffect(() => {
    activeHistoricoIdRef.current = activeHistoricoId;
  }, [activeHistoricoId]);

  // Load saved data when user is available
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
    // Clear any auto-sending state on load — only send when user clicks the button
    localStorage.removeItem(AUTO_SENDING_KEY);
  }, [user]);

  // Fetch UAZAPI config from database
  useEffect(() => {
    if (!user) return;
    const fetchConfig = async () => {
      const { data } = await supabase
        .from('user_whatsapp_config')
        .select('server_url, instance_token')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setUazapiServerUrl(data.server_url);
        setUazapiInstanceToken(data.instance_token);
        setUazapiConfigured(true);
        uazapiConfigRef.current = { server_url: data.server_url, instance_token: data.instance_token };
      }
    };
    fetchConfig();
  }, [user]);

  // Auto-resume is intentionally DISABLED — auto-send only starts when user clicks the button

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
      // If user has UAZAPI config (non-admin), pass credentials
      const config = uazapiConfigRef.current;
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

  const runAutoSendLoop = async (clientesList: ClienteData[], statusMap: Record<number, SendStatus>, checkedSet: Set<number>, minSec: number, maxSec: number, historicoId: string | null) => {
    autoSendingRef.current = true;
    setAutoSending(true);

    // snapshot current pendentes using provided data
    const pendentesSnapshot = clientesList
      .map((c, i) => ({ ...c, originalIndex: i }))
      .filter(c => statusMap[c.originalIndex] !== 'success' && !checkedSet.has(c.originalIndex));

    if (pendentesSnapshot.length === 0) {
      toast.error('Não há clientes pendentes para enviar');
      autoSendingRef.current = false;
      setAutoSending(false);
      localStorage.removeItem(AUTO_SENDING_KEY);
      return;
    }

    // Save auto-send state to localStorage
    localStorage.setItem(AUTO_SENDING_KEY, JSON.stringify({
      active: true,
      historicoId: historicoId,
      minSec,
      maxSec,
    }));

    let lastDelay = -1;

    for (let i = 0; i < pendentesSnapshot.length; i++) {
      if (!autoSendingRef.current) break;

      setAutoProgress({ current: i + 1, total: pendentesSnapshot.length });

      const cliente = pendentesSnapshot[i];
      await handleSend(cliente.originalIndex);

      // Wait random delay before next (skip delay after last one)
      if (i < pendentesSnapshot.length - 1 && autoSendingRef.current) {
        let delay: number;
        do {
          delay = Math.floor(Math.random() * (maxSec - minSec + 1)) + minSec;
        } while (delay === lastDelay && maxSec - minSec >= 1);
        lastDelay = delay;

        await new Promise(resolve => setTimeout(resolve, delay * 1000));
      }
    }

    autoSendingRef.current = false;
    setAutoSending(false);
    setAutoProgress(null);
    localStorage.removeItem(AUTO_SENDING_KEY);
    if (pendentesSnapshot.length > 0) {
      setActiveTab('enviados');
      toast.success('Envio automático finalizado');
    }
  };

  const handleAutoSend = async () => {
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

    await runAutoSendLoop(clientes, sendStatus, manualChecked, autoMinSec, autoMaxSec, activeHistoricoId);
  };

  const handleAutoSendResume = async (item: HistoricoItem, minSec: number, maxSec: number) => {
    // Load saved messages
    const savedMsgs = localStorage.getItem(MENSAGENS_KEY);
    let msgs: string[] = [];
    if (savedMsgs) {
      try { msgs = JSON.parse(savedMsgs); } catch {}
    }
    if (msgs.length === 0) {
      toast.error('Sem mensagens salvas para retomar o envio');
      localStorage.removeItem(AUTO_SENDING_KEY);
      return;
    }

    // Restore historico data
    setClientes(item.clientes);
    setActiveHistoricoId(item.id);
    localStorage.setItem(ACTIVE_KEY, item.id);

    // Load persisted send status
    let statusMap: Record<number, SendStatus> = {};
    const savedStatus = localStorage.getItem(`${SEND_STATUS_KEY}_${item.id}`);
    if (savedStatus) {
      try { statusMap = JSON.parse(savedStatus); } catch {}
    }
    setSendStatus(statusMap);

    let checkedSet = new Set<number>();
    const savedManual = localStorage.getItem(`${MANUAL_CHECKED_KEY}_${item.id}`);
    if (savedManual) {
      try { checkedSet = new Set(JSON.parse(savedManual)); } catch {}
    }
    setManualChecked(checkedSet);

    const savedTs = localStorage.getItem(`${SEND_TIMESTAMPS_KEY}_${item.id}`);
    if (savedTs) {
      try { setSendTimestamps(JSON.parse(savedTs)); } catch {}
    }

    setMensagensSalvas(msgs);
    toast.info('Retomando envio automático...');

    await runAutoSendLoop(item.clientes, statusMap, checkedSet, minSec, maxSec, item.id);
  };

  const handleStopAutoSend = () => {
    autoSendingRef.current = false;
    setAutoSending(false);
    setAutoProgress(null);
    localStorage.removeItem(AUTO_SENDING_KEY);
    toast.info('Envio automático parado');
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

  const handleSaveUazapiConfig = async () => {
    if (!user) return;
    if (!uazapiServerUrl.trim() || !uazapiInstanceToken.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }
    setSavingConfig(true);
    try {
      const { error } = await supabase
        .from('user_whatsapp_config')
        .upsert({
          user_id: user.id,
          server_url: uazapiServerUrl.trim(),
          instance_token: uazapiInstanceToken.trim(),
          atualizado_em: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      if (error) throw error;
      setUazapiConfigured(true);
      uazapiConfigRef.current = { server_url: uazapiServerUrl.trim(), instance_token: uazapiInstanceToken.trim() };
      toast.success('Configuração salva com sucesso!');
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err.message}`);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleTestUazapiConnection = async () => {
    if (!uazapiServerUrl || !uazapiInstanceToken) {
      toast.error('Preencha o Server URL e o Instance Token');
      return;
    }
    setTestingConnection(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-uazapi-connection', {
        body: { server_url: uazapiServerUrl, instance_token: uazapiInstanceToken }
      });
      if (error) throw error;
      if (data?.ok) {
        toast.success(`Conexão com UAZAPI bem-sucedida! (${data.endpoint})`);
      } else {
        const detail = data?.data?.message || data?.data?.error || data?.error || JSON.stringify(data?.data);
        toast.error(`UAZAPI respondeu com erro (status ${data?.status}): ${detail}`);
      }
    } catch (error: any) {
      toast.error(`Não foi possível conectar à UAZAPI: ${error.message || 'Verifique o Server URL.'}`);
    } finally {
      setTestingConnection(false);
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
      const config = uazapiConfigRef.current;
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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setConfigDialogOpen(true)}
              className="text-muted-foreground"
            >
              <Settings className="h-5 w-5" />
            </Button>
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
              {/* Auto-send controls */}
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

              {/* Config moved to Dialog */}
            </CardContent>
          </Card>
        )}

        {/* Config Dialog */}
        <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Configurações</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {isAdmin ? (
                <div className="rounded-md border p-4 bg-muted/30">
                  <p className="text-sm text-muted-foreground">
                    Sua conta de administrador utiliza a <strong>Z-API</strong> configurada no sistema. Não é necessário configurar credenciais aqui.
                  </p>
                  <Badge variant="default" className="mt-2">Z-API (Padrão do sistema)</Badge>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold">Configuração UAZAPI</h3>
                    {uazapiConfigured ? (
                      <Badge variant="default">Configurado</Badge>
                    ) : (
                      <Badge variant="destructive">Não configurado</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Configure suas credenciais da UAZAPI para enviar mensagens pelo seu próprio número de WhatsApp.
                  </p>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="server-url">Server URL</Label>
                      <Input
                        id="server-url"
                        placeholder="https://certificadoracnpj.uazapi.com"
                        value={uazapiServerUrl}
                        onChange={(e) => setUazapiServerUrl(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="instance-token">Instance Token</Label>
                      <Input
                        id="instance-token"
                        placeholder="c01095d6-64d4-4b33-9c1f-86a09948dc7c"
                        value={uazapiInstanceToken}
                        onChange={(e) => setUazapiInstanceToken(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSaveUazapiConfig} disabled={savingConfig}>
                        {savingConfig ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        Salvar
                      </Button>
                      <Button variant="outline" onClick={handleTestUazapiConnection} disabled={testingConnection || !uazapiServerUrl || !uazapiInstanceToken}>
                        {testingConnection ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wifi className="h-4 w-4 mr-2" />}
                        Testar conexão
                      </Button>
                    </div>
                  </div>
                </div>
              )}

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
