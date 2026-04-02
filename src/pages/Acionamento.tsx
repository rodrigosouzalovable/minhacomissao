import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { QrCode, Smartphone } from 'lucide-react';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useAutoSend } from '@/hooks/useAutoSend';
import type { UazapiInstance } from '@/hooks/useAutoSend';
import { Upload, Save, Check, X, Loader2, Trash2, FileSpreadsheet, Play, Square, Settings, Wifi, WifiOff, Send, Plus, Pencil, Target, AlertTriangle, RefreshCw, Bot, MessageCircle, Copy, Calculator, Clock, CalendarClock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import ChatbotTemplatesTab from '@/components/ChatbotTemplatesTab';
import ChatHistoryDialog from '@/components/ChatHistoryDialog';
import LembreteMensagensDialog from '@/components/LembreteMensagensDialog';
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

const normalizePhoneForWhatsApp = (phone: string): string => {
  const clean = phone.replace(/\D/g, '');
  const full = clean.startsWith('55') ? clean : `55${clean}`;
  // Remove 9th digit for BR mobile: 55 + DDD(2) + 9 + 8 digits → 55 + DDD(2) + 8 digits
  if (full.length === 13 && full[4] === '9') {
    return full.slice(0, 4) + full.slice(5);
  }
  return full;
};

interface ConversaInfo {
  etapa: string;
  historico: Array<{ role: string; content: string; ts?: string }>;
}

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

const calcAvista = (saldo: number): string => formatCurrency(saldo * 0.5);

const calcParcelado = (saldo: number): string => {
  const valorComDesconto = saldo * 0.7;
  const opcoes: string[] = [];
  for (let i = 2; i <= 24; i++) {
    const valorParcela = valorComDesconto / i;
    if (valorParcela >= 100) {
      opcoes.push(`- ${i}x de ${formatCurrency(valorParcela)}`);
    }
  }
  return opcoes.join('\n');
};

const calcParceladoDisplay = (saldo: number): string => {
  const valorComDesconto = saldo * 0.7;
  const opcoes: { parcelas: number; valor: number }[] = [];
  for (let i = 2; i <= 24; i++) {
    const valorParcela = valorComDesconto / i;
    if (valorParcela >= 100) {
      opcoes.push({ parcelas: i, valor: valorParcela });
    }
  }
  if (opcoes.length === 0) return '—';
  if (opcoes.length === 1) return `${opcoes[0].parcelas}x de ${formatCurrency(opcoes[0].valor)}`;
  return `${opcoes[0].parcelas}x de ${formatCurrency(opcoes[0].valor)} até ${opcoes[opcoes.length - 1].parcelas}x de ${formatCurrency(opcoes[opcoes.length - 1].valor)}`;
};

const replaceVariables = (template: string, cliente: ClienteData): string =>
  template
    .replace(/\{nome\}/g, cliente.nome)
    .replace(/\{primeiro_nome\}/g, formatPrimeiroNome(cliente.nome))
    .replace(/\{cpf\}/g, cliente.cpf)
    .replace(/\{atraso\}/g, String(cliente.atraso))
    .replace(/\{saldo\}/g, formatCurrency(cliente.saldo))
    .replace(/\{avista\}/g, calcAvista(cliente.saldo))
    .replace(/\{parcelado\}/g, calcParcelado(cliente.saldo));

const variables = [
  { key: '{nome}', label: 'Nome completo' },
  { key: '{primeiro_nome}', label: 'Primeiro nome (capitalizado)' },
  { key: '{cpf}', label: 'CPF' },
  { key: '{atraso}', label: 'Atraso (dias)' },
  { key: '{saldo}', label: 'Saldo (R$)' },
  { key: '{avista}', label: 'Valor à vista (50% desc.)' },
  { key: '{parcelado}', label: 'Opções parceladas (30% desc.)' },
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
  const [activeTab, setActiveTab] = useState<'pendentes' | 'enviados' | 'ia'>('pendentes');
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [lembreteMensagensOpen, setLembreteMensagensOpen] = useState(false);
  
  // Multi-instance UAZAPI state
  const [instances, setInstances] = useState<Array<{ id: string; nome: string; server_url: string; instance_token: string; ativo: boolean; apenas_lembretes: boolean; robo: boolean; ia_responde: boolean }>>([]);
  const [editingInstance, setEditingInstance] = useState<InstanceFormData | null>(null);
  const [savingInstance, setSavingInstance] = useState(false);
  const [testingInstanceId, setTestingInstanceId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<Record<string, 'connected' | 'disconnected' | 'checking'>>({});
  const [checkingConnections, setCheckingConnections] = useState(false);

  // QR Code connection state
  const [qrLoading, setQrLoading] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [qrPolling, setQrPolling] = useState(false);
  const [qrStep, setQrStep] = useState<'idle' | 'qr' | 'manual'>('idle');
  const [qrCountdown, setQrCountdown] = useState(60);
  const [createdInstanceId, setCreatedInstanceId] = useState<string | null>(null);
  const [reconnectingInstanceId, setReconnectingInstanceId] = useState<string | null>(null);
  const qrPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qrCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [autoMinSec, setAutoMinSec] = useState(10);
  const [autoMaxSec, setAutoMaxSec] = useState(30);
  
  // Scheduling state
  const [agendamentos, setAgendamentos] = useState<Array<{ id: string; agendado_para: string; status: string; total_enviados: number; total_erros: number; historico_data: any }>>([]);
  const [agendandoEnvio, setAgendandoEnvio] = useState(false);
  const [agendamentoData, setAgendamentoData] = useState('');
  const [agendamentoHora, setAgendamentoHora] = useState('08:00');
  
  // Conversation tracking state
  const [conversasMap, setConversasMap] = useState<Record<string, ConversaInfo>>({});
  const [chatDialogOpen, setChatDialogOpen] = useState(false);
  const [selectedConversa, setSelectedConversa] = useState<{ etapa: string; historico: Array<{ role: string; content: string; ts?: string }>; telefone: string; clienteNome: string } | null>(null);
  
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
        .select('id, nome, server_url, instance_token, ativo, apenas_lembretes, robo, ia_responde')
        .eq('user_id', user.id)
        .order('criado_em', { ascending: true });
      if (data) {
        setInstances(data as any);
      }
    };
    fetchInstances();
  }, [user]);


  const checkInstanceConnections = useCallback(async (instancesToCheck: typeof instances) => {
    const activeOnes = instancesToCheck.filter(i => i.ativo);
    if (activeOnes.length === 0) return;

    setCheckingConnections(true);
    const initialStatus: Record<string, 'connected' | 'disconnected' | 'checking'> = {};
    activeOnes.forEach(i => { initialStatus[i.id] = 'checking'; });
    setConnectionStatus(prev => ({ ...prev, ...initialStatus }));

    await Promise.all(activeOnes.map(async (inst) => {
      try {
        const { data, error } = await supabase.functions.invoke('test-uazapi-connection', {
          body: { server_url: inst.server_url, instance_token: inst.instance_token }
        });
        if (error) throw error;
        const isConnected = data?.ok && data?.data?.status?.connected === true;
        setConnectionStatus(prev => ({ ...prev, [inst.id]: isConnected ? 'connected' : 'disconnected' }));
      } catch {
        setConnectionStatus(prev => ({ ...prev, [inst.id]: 'disconnected' }));
      }
    }));
    setCheckingConnections(false);
  }, []);

  // Check connections when instances are loaded
  useEffect(() => {
    if (instances.length > 0) {
      checkInstanceConnections(instances);
    }
  }, [instances, checkInstanceConnections]);

  const disconnectedInstances = useMemo(() => 
    instances.filter(i => i.ativo && connectionStatus[i.id] === 'disconnected'),
    [instances, connectionStatus]
  );

  const connectedCount = useMemo(() => 
    instances.filter(i => connectionStatus[i.id] === 'connected').length,
    [instances, connectionStatus]
  );

  const activeInstances = useMemo(() => 
    instances.filter(i => i.ativo && connectionStatus[i.id] === 'connected' && !i.apenas_lembretes && i.robo), 
    [instances, connectionStatus]
  );

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
    if (activeInstances.length === 0) {
      toast.error('Nenhuma instância WhatsApp do tipo Robô está conectada. Conecte uma instância antes de enviar.');
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
    if (activeInstances.length === 0) {
      toast.error('Nenhuma instância WhatsApp do tipo Robô está conectada. Conecte uma instância antes de enviar.');
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

  const handleCalcInterval = () => {
    const numRobos = activeInstances.length;
    if (numRobos === 0) {
      toast.error('Nenhuma instância Robô conectada para calcular');
      return;
    }
    const intervaloMedio = 36000 / (30 * numRobos);
    const min = Math.max(1, Math.floor(intervaloMedio * 0.8));
    const max = Math.ceil(intervaloMedio * 1.2);
    setAutoMinSec(min);
    setAutoMaxSec(max);
    toast.success(`Intervalo calculado: ${min}s a ${max}s (~30 msgs/número/dia, 8h-18h)`);
  };

  // Fetch agendamentos
  const fetchAgendamentos = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('acionamento_agendamentos')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['pendente', 'executando'])
      .order('agendado_para', { ascending: true });
    if (data) setAgendamentos(data as any);
  }, [user]);

  useEffect(() => {
    fetchAgendamentos();
  }, [fetchAgendamentos]);

  const handleAgendar = async () => {
    if (!user || !agendamentoData || !agendamentoHora) {
      toast.error('Selecione data e hora para agendar');
      return;
    }
    if (mensagensSalvas.length === 0) {
      toast.error('Salve pelo menos uma mensagem antes de agendar');
      return;
    }
    if (clientes.length === 0) {
      toast.error('Importe uma planilha de clientes antes de agendar');
      return;
    }

    setAgendandoEnvio(true);
    try {
      const agendadoPara = new Date(`${agendamentoData}T${agendamentoHora}:00`).toISOString();
      
      // Filter only pending clients
      const pendingClientes = clientes.filter((_, i) => 
        sendStatus[i] !== 'success' && sendStatus[i] !== 'error' && !manualChecked.has(i)
      );

      if (pendingClientes.length === 0) {
        toast.error('Não há clientes pendentes para agendar');
        return;
      }

      const { error } = await supabase
        .from('acionamento_agendamentos')
        .insert({
          user_id: user.id,
          historico_data: { clientes: pendingClientes, mensagens: mensagensSalvas },
          agendado_para: agendadoPara,
          min_sec: autoMinSec,
          max_sec: autoMaxSec,
        } as any);

      if (error) throw error;
      toast.success(`Envio agendado para ${agendamentoData} às ${agendamentoHora}`);
      setAgendamentoData('');
      setAgendamentoHora('08:00');
      fetchAgendamentos();
    } catch (err: any) {
      toast.error(`Erro ao agendar: ${err.message}`);
    } finally {
      setAgendandoEnvio(false);
    }
  };

  const handleCancelAgendamento = async (agendamentoId: string) => {
    const { error } = await supabase
      .from('acionamento_agendamentos')
      .update({ status: 'cancelado' } as any)
      .eq('id', agendamentoId);
    if (error) {
      toast.error('Erro ao cancelar');
    } else {
      toast.success('Agendamento cancelado');
      fetchAgendamentos();
    }
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

  // Fetch conversation states for enviados phones (polling every 30s)
  const fetchConversas = useCallback(async () => {
    if (enviados.length === 0) return;
    const phones = enviados.map(c => normalizePhoneForWhatsApp(c.telefone));
    const uniquePhones = [...new Set(phones)];
    if (uniquePhones.length === 0) return;

    const { data, error } = await supabase
      .from('chatbot_conversas')
      .select('telefone, etapa, dados')
      .in('telefone', uniquePhones);

    if (error || !data) return;

    const map: Record<string, ConversaInfo> = {};
    for (const row of data) {
      const dados = row.dados as any;
      const historico = Array.isArray(dados?.mensagens_historico) ? dados.mensagens_historico : [];
      map[row.telefone] = { etapa: row.etapa, historico };
    }
    setConversasMap(map);
  }, [enviados]);

  useEffect(() => {
    if (activeTab !== 'enviados' || enviados.length === 0) return;
    fetchConversas();
    const interval = setInterval(fetchConversas, 30000);
    return () => clearInterval(interval);
  }, [activeTab, fetchConversas, enviados.length]);

  const getConversaStatus = (telefone: string) => {
    const normalized = normalizePhoneForWhatsApp(telefone);
    const conversa = conversasMap[normalized];
    if (!conversa) return null;
    
    const hasClientMsg = conversa.historico.some(m => m.role === 'cliente' || m.role === 'user');
    if (conversa.etapa === 'acordo_finalizado') return 'acordo';
    if (conversa.etapa === 'aguardando_humano') return 'aguardando';
    if (hasClientMsg) return 'negociando';
    return null;
  };

  const handleOpenChat = (cliente: { nome: string; telefone: string }) => {
    const normalized = normalizePhoneForWhatsApp(cliente.telefone);
    const conversa = conversasMap[normalized];
    if (!conversa) return;
    setSelectedConversa({
      etapa: conversa.etapa,
      historico: conversa.historico,
      telefone: cliente.telefone,
      clienteNome: cliente.nome,
    });
    setChatDialogOpen(true);
  };

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

  // QR Code connection handlers
  const stopQrPolling = useCallback(() => {
    if (qrPollingRef.current) clearInterval(qrPollingRef.current);
    if (qrCountdownRef.current) clearInterval(qrCountdownRef.current);
    setQrPolling(false);
    qrPollingRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      if (qrPollingRef.current) clearInterval(qrPollingRef.current);
      if (qrCountdownRef.current) clearInterval(qrCountdownRef.current);
    };
  }, []);

  const startQrCountdown = () => {
    if (qrCountdownRef.current) clearInterval(qrCountdownRef.current);
    setQrCountdown(60);
    qrCountdownRef.current = setInterval(() => {
      setQrCountdown((prev) => {
        if (prev <= 1) {
          if (qrCountdownRef.current) clearInterval(qrCountdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startQrPolling = useCallback((instanceId: string) => {
    if (qrPollingRef.current) clearInterval(qrPollingRef.current);
    setQrPolling(true);

    qrPollingRef.current = setInterval(async () => {
      try {
        const { data } = await supabase.functions.invoke('whatsapp-qr', {
          body: { action: 'status', userId: user?.id, instanceId },
        });

        if (data?.connected) {
          stopQrPolling();
          // Auto-configure webhook
          await supabase.functions.invoke('whatsapp-qr', {
            body: { action: 'setup-webhook', userId: user?.id, instanceId },
          });
          // Refresh instances list
          const { data: refreshed } = await supabase
            .from('user_whatsapp_instances' as any)
            .select('id, nome, server_url, instance_token, ativo, apenas_lembretes, robo, ia_responde')
            .eq('user_id', user?.id)
            .order('criado_em', { ascending: true });
          if (refreshed) setInstances(refreshed as any);
          setQrStep('idle');
          setQrImage(null);
          setPairingCode(null);
          setCreatedInstanceId(null);
          setEditingInstance(null);
          toast.success('WhatsApp conectado com sucesso! Webhook configurado automaticamente.');
          checkInstanceConnections(refreshed as any || []);
        }
      } catch (_) {}
    }, 3000);
  }, [user?.id, stopQrPolling, checkInstanceConnections]);

  const handleConnectQr = async () => {
    if (!user) return;
    setQrLoading(true);
    setQrImage(null);
    setPairingCode(null);

    try {
      // Step 1: Create instance
      const { data: createData, error: createError } = await supabase.functions.invoke('whatsapp-qr', {
        body: { action: 'create-instance', userId: user.id },
      });

      if (createError) throw createError;
      if (!createData?.ok) throw new Error(createData?.error || 'Falha ao criar instância');

      const instanceId = createData.instanceId;
      setCreatedInstanceId(instanceId);

      // Step 2: Fetch QR code
      const { data: qrData, error: qrError } = await supabase.functions.invoke('whatsapp-qr', {
        body: { action: 'qr', userId: user.id, instanceId },
      });

      if (qrError) throw qrError;

      if (qrData?.alreadyConnected) {
        const { data: refreshed } = await supabase
          .from('user_whatsapp_instances' as any)
          .select('id, nome, server_url, instance_token, ativo, apenas_lembretes, robo, ia_responde')
          .eq('user_id', user.id)
          .order('criado_em', { ascending: true });
        if (refreshed) setInstances(refreshed as any);
        setQrStep('idle');
        toast.success('WhatsApp já está conectado!');
      } else if (qrData?.ok && qrData.qr) {
        const qr = qrData.qr.startsWith('data:') ? qrData.qr : `data:image/png;base64,${qrData.qr}`;
        setQrImage(qr);
        setPairingCode(qrData.pairingCode || null);
        setQrStep('qr');
        startQrPolling(instanceId);
        startQrCountdown();
      } else {
        toast.error(qrData?.error || 'Não foi possível obter o QR Code');
      }
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    }
    setQrLoading(false);
  };

  const handleRefreshQr = async () => {
    if (!createdInstanceId || !user) return;
    stopQrPolling();
    setQrLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-qr', {
        body: { action: 'qr', userId: user.id, instanceId: createdInstanceId },
      });
      if (error) throw error;
      if (data?.ok && data.qr) {
        const qr = data.qr.startsWith('data:') ? data.qr : `data:image/png;base64,${data.qr}`;
        setQrImage(qr);
        setPairingCode(data.pairingCode || null);
        startQrPolling(createdInstanceId);
        startQrCountdown();
      } else {
        toast.error(data?.error || 'Não foi possível obter o QR Code');
      }
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    }
    setQrLoading(false);
  };

  const handleCancelQr = () => {
    stopQrPolling();
    setQrStep('idle');
    setQrImage(null);
    setPairingCode(null);
    setCreatedInstanceId(null);
    // If instance was created but not connected, delete it
    if (createdInstanceId) {
      supabase.functions.invoke('whatsapp-qr', {
        body: { action: 'disconnect', userId: user?.id, instanceId: createdInstanceId },
      }).then(() => {
        setInstances(prev => prev.filter(i => i.id !== createdInstanceId));
      });
    }
  };

  const handleReconnectQr = async () => {
    if (!user || !editingInstance?.id) return;
    const instanceId = editingInstance.id;
    setReconnectingInstanceId(instanceId);
    setQrLoading(true);
    setQrImage(null);
    setPairingCode(null);

    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-qr', {
        body: { action: 'qr', userId: user.id, instanceId },
      });
      if (error) throw error;

      if (data?.alreadyConnected) {
        setReconnectingInstanceId(null);
        setConnectionStatus(prev => ({ ...prev, [instanceId]: 'connected' }));
        toast.success('WhatsApp já está conectado!');
      } else if (data?.ok && data.qr) {
        const qr = data.qr.startsWith('data:') ? data.qr : `data:image/png;base64,${data.qr}`;
        setQrImage(qr);
        setPairingCode(data.pairingCode || null);
        startQrPolling(instanceId);
        startQrCountdown();
      } else {
        toast.error(data?.error || 'Não foi possível obter o QR Code');
        setReconnectingInstanceId(null);
      }
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
      setReconnectingInstanceId(null);
    }
    setQrLoading(false);
  };

  const handleReconnectRefreshQr = async () => {
    if (!reconnectingInstanceId || !user) return;
    stopQrPolling();
    setQrLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-qr', {
        body: { action: 'qr', userId: user.id, instanceId: reconnectingInstanceId },
      });
      if (error) throw error;
      if (data?.ok && data.qr) {
        const qr = data.qr.startsWith('data:') ? data.qr : `data:image/png;base64,${data.qr}`;
        setQrImage(qr);
        setPairingCode(data.pairingCode || null);
        startQrPolling(reconnectingInstanceId);
        startQrCountdown();
      } else {
        toast.error(data?.error || 'Não foi possível obter o QR Code');
      }
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    }
    setQrLoading(false);
  };

  const handleCancelReconnect = () => {
    stopQrPolling();
    setQrImage(null);
    setPairingCode(null);
    setReconnectingInstanceId(null);
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

  const handleToggleApenasLembretes = async (id: string, apenas_lembretes: boolean) => {
    const updateData: any = { apenas_lembretes };
    if (apenas_lembretes) { updateData.robo = false; updateData.ia_responde = false; }
    const { error } = await supabase
      .from('user_whatsapp_instances' as any)
      .update(updateData)
      .eq('id', id);
    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }

    // Ao marcar como "Apenas Lembretes", atualizar o perfil para usar esta instância como principal para lembretes
    if (apenas_lembretes && user) {
      const inst = instances.find(i => i.id === id);
      if (inst) {
        await supabase
          .from('profiles')
          .update({
            whatsapp_lembrete_server_url: inst.server_url,
            whatsapp_lembrete_instance_token: inst.instance_token,
          })
          .eq('id', user.id);
        toast.success('Instância marcada como dedicada para lembretes e sincronizada com seu perfil');
      }
    }

    setInstances(prev => prev.map(i => i.id === id ? { ...i, apenas_lembretes, ...(apenas_lembretes ? { robo: false, ia_responde: false } : {}) } : i));
    if (!apenas_lembretes) toast.success('Restrição removida');
  };

  const handleToggleRobo = async (id: string, robo: boolean) => {
    const updateData: any = { robo };
    if (robo) updateData.apenas_lembretes = false;
    const { error } = await supabase
      .from('user_whatsapp_instances' as any)
      .update(updateData)
      .eq('id', id);
    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }
    setInstances(prev => prev.map(i => i.id === id ? { ...i, robo, ...(robo ? { apenas_lembretes: false } : {}) } : i));
    toast.success(robo ? 'Instância habilitada para o robô de acionamento' : 'Robô desativado nesta instância');
  };

  const handleToggleIaResponde = async (id: string, ia_responde: boolean) => {
    const updateData: any = { ia_responde };
    if (ia_responde) updateData.apenas_lembretes = false;
    const { error } = await supabase
      .from('user_whatsapp_instances' as any)
      .update(updateData)
      .eq('id', id);
    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }
    setInstances(prev => prev.map(i => i.id === id ? { ...i, ia_responde, ...(ia_responde ? { apenas_lembretes: false } : {}) } : i));
    toast.success(ia_responde ? 'IA habilitada para responder nesta instância' : 'IA desativada nesta instância');
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

  const handleTestSend = async (msgOverride?: string) => {
    if (!testPhone.trim()) {
      toast.error('Digite um número de telefone para teste');
      return;
    }
    const msgToSend = msgOverride || mensagem;
    if (!msgToSend.trim()) {
      toast.error('Digite uma mensagem antes de testar');
      return;
    }
    setSendingTest(true);
    try {
      const body: any = { telefone: testPhone.trim(), mensagem: msgToSend.trim() };
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
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Acionamento</h1>
          {instances.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => checkInstanceConnections(instances)}
              disabled={checkingConnections}
              className="text-muted-foreground"
            >
              {checkingConnections ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-1 text-xs">Verificar conexões</span>
            </Button>
          )}
        </div>

        {/* Alert banner for disconnected instances */}
        {disconnectedInstances.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>WhatsApp desconectado</AlertTitle>
            <AlertDescription>
              {disconnectedInstances.map(i => i.nome || 'Sem nome').join(', ')} — Reconecte os aparelhos no painel UAZAPI.
            </AlertDescription>
          </Alert>
        )}

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
                size="sm"
                onClick={() => setLembreteMensagensOpen(true)}
                className="text-muted-foreground gap-1"
              >
                <MessageCircle className="h-4 w-4" />
                <span className="text-xs">Mensagens de Lembrete</span>
              </Button>
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
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={handleSaveMessage}>
                <Save className="h-4 w-4 mr-2" /> Salvar mensagem
              </Button>
              <div className="flex gap-2 items-center">
                <Input
                  placeholder="Número para teste (ex: 62999999999)"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="w-64"
                />
                <Button
                  variant="outline"
                  onClick={() => handleTestSend()}
                  disabled={sendingTest || !testPhone.trim() || !mensagem.trim()}
                >
                  {sendingTest ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  Testar envio
                </Button>
              </div>
            </div>

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
                {isAdmin && (
                  <Button
                    variant={activeTab === 'ia' ? 'default' : 'outline'}
                    onClick={() => setActiveTab('ia')}
                  >
                    <Bot className="h-4 w-4 mr-1" />
                    IA
                  </Button>
                )}
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
                          <TableHead>Saldo</TableHead>
                          <TableHead>À Vista</TableHead>
                          <TableHead>Parcelado</TableHead>
                          <TableHead className="w-24 text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendentes.map((c) => (
                          <TableRow key={c.originalIndex}>
                            <TableCell className="font-medium">{c.nome}</TableCell>
                            <TableCell>{c.telefone}</TableCell>
                            <TableCell>{formatCurrency(c.saldo)}</TableCell>
                            <TableCell className="text-green-600 font-medium">{calcAvista(c.saldo)}</TableCell>
                            <TableCell className="text-xs max-w-[200px]">{calcParceladoDisplay(c.saldo)}</TableCell>
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
                          <TableHead>Saldo</TableHead>
                          <TableHead>À Vista</TableHead>
                          <TableHead>Parcelado</TableHead>
                          <TableHead>Enviado em</TableHead>
                          <TableHead className="w-24 text-right">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {enviados.map((c) => {
                          const wasSent = sendStatus[c.originalIndex] === 'success';
                          const wasError = sendStatus[c.originalIndex] === 'error';
                          const wasManual = manualChecked.has(c.originalIndex);
                          const timestamp = sendTimestamps[c.originalIndex];
                          const formattedTimestamp = timestamp
                            ? new Date(timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
                            : '—';
                          const conversaStatus = getConversaStatus(c.telefone);
                          return (
                            <TableRow key={c.originalIndex}>
                              <TableCell className="font-medium">{c.nome}</TableCell>
                              <TableCell>{c.telefone}</TableCell>
                              <TableCell>{formatCurrency(c.saldo)}</TableCell>
                              <TableCell className="text-green-600 font-medium">{calcAvista(c.saldo)}</TableCell>
                              <TableCell className="text-xs max-w-[200px]">{calcParceladoDisplay(c.saldo)}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{formattedTimestamp}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {conversaStatus === 'negociando' && (
                                    <Badge
                                      variant="outline"
                                      className="cursor-pointer bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30"
                                      onClick={() => handleOpenChat(c)}
                                    >
                                      <MessageCircle className="h-3 w-3 mr-1" /> Em negociação
                                    </Badge>
                                  )}
                                  {conversaStatus === 'aguardando' && (
                                    <Badge
                                      variant="outline"
                                      className="cursor-pointer bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30"
                                      onClick={() => handleOpenChat(c)}
                                    >
                                      <MessageCircle className="h-3 w-3 mr-1" /> Aguardando
                                    </Badge>
                                  )}
                                  {conversaStatus === 'acordo' && (
                                    <Badge
                                      variant="outline"
                                      className="cursor-pointer bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30"
                                      onClick={() => handleOpenChat(c)}
                                    >
                                      <Check className="h-3 w-3 mr-1" /> Acordo
                                    </Badge>
                                  )}
                                  {!conversaStatus && wasSent && (
                                    <Badge variant="default" className="bg-green-600 hover:bg-green-600">
                                      <Check className="h-3 w-3 mr-1" /> Enviado
                                    </Badge>
                                  )}
                                  {!conversaStatus && wasError && (
                                    <Badge variant="destructive">
                                      <X className="h-3 w-3 mr-1" /> Erro
                                    </Badge>
                                  )}
                                  {!conversaStatus && wasManual && !wasSent && !wasError && (
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

              {activeTab === 'ia' && isAdmin && (
                <ChatbotTemplatesTab />
              )}
            </CardContent>
          </Card>
        )}

        {/* Config Dialog */}
        <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
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
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold">Instâncias UAZAPI</h3>
                      {instances.length > 0 && (
                        <Badge variant={connectedCount > 0 ? 'default' : 'secondary'} className="text-xs">
                          {connectedCount}/{instances.length} conectado{connectedCount !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Cadastre múltiplos WhatsApps para rotação automática dos envios.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleConnectQr}
                      disabled={qrLoading || qrStep === 'qr'}
                    >
                      {qrLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <QrCode className="h-4 w-4 mr-1" />}
                      Conectar via QR Code
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setQrStep('manual');
                        setEditingInstance({ nome: '', server_url: 'https://certificadoracnpj.uazapi.com', instance_token: '' });
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Manual
                    </Button>
                  </div>
                </div>

                  {/* QR Code connection flow */}
                  {qrStep === 'qr' && (
                    <div className="rounded-md border p-6 space-y-4 bg-muted/20">
                      <div className="flex flex-col items-center gap-4">
                        <Smartphone className="h-8 w-8 text-primary" />
                        <p className="text-sm font-medium text-center">
                          Escaneie o QR Code com o WhatsApp
                        </p>

                        {qrImage && (
                          <div className="bg-background p-3 rounded-lg border shadow-sm">
                            <img src={qrImage} alt="QR Code WhatsApp" className="w-64 h-64 object-contain" />
                          </div>
                        )}

                        {pairingCode && (
                          <div className="text-center space-y-1">
                            <p className="text-xs text-muted-foreground">Ou use o código de pareamento:</p>
                            <p className="text-2xl font-mono font-bold tracking-widest text-primary">
                              {pairingCode.slice(0, 4)}-{pairingCode.slice(4)}
                            </p>
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {qrPolling && <Loader2 className="h-4 w-4 animate-spin" />}
                          <span>
                            {qrCountdown > 0 ? `Aguardando conexão... (${qrCountdown}s)` : 'QR Code expirado'}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2 justify-center">
                        <Button variant="outline" size="sm" onClick={handleRefreshQr} disabled={qrLoading}>
                          {qrLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                          Atualizar QR Code
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleCancelQr}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}

                   {/* Manual instance form (add/edit) */}
                  {(qrStep === 'manual' || (editingInstance && editingInstance.id)) && editingInstance && (
                    <div className="rounded-md border p-4 space-y-3 bg-muted/20" ref={(el) => { if (el && editingInstance.id) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>
                      <h4 className="text-sm font-semibold">{editingInstance.id ? 'Editar instância' : 'Nova instância (manual)'}</h4>
                      <div className="space-y-2">
                        <Label>Nome (opcional)</Label>
                        <Input
                          placeholder="Ex: 62981810202"
                          value={editingInstance.nome}
                          onChange={(e) => setEditingInstance({ ...editingInstance, nome: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Server URL</Label>
                        <Input
                          placeholder="https://certificadoracnpj.uazapi.com"
                          value={editingInstance.server_url}
                          onChange={(e) => !editingInstance.id && setEditingInstance({ ...editingInstance, server_url: e.target.value })}
                          readOnly={!!editingInstance.id}
                          className={editingInstance.id ? 'bg-muted cursor-not-allowed opacity-60' : ''}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Instance Token</Label>
                        <Input
                          placeholder="c01095d6-64d4-4b33-9c1f-86a09948dc7c"
                          value={editingInstance.instance_token}
                          onChange={(e) => !editingInstance.id && setEditingInstance({ ...editingInstance, instance_token: e.target.value })}
                          readOnly={!!editingInstance.id}
                          className={editingInstance.id ? 'bg-muted cursor-not-allowed opacity-60' : ''}
                        />
                      </div>

                      {/* Reconnect via QR button - only for existing disconnected instances */}
                      {editingInstance.id && connectionStatus[editingInstance.id] === 'disconnected' && !reconnectingInstanceId && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-orange-500/50 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20"
                          onClick={handleReconnectQr}
                          disabled={qrLoading}
                        >
                          {qrLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <QrCode className="h-4 w-4 mr-1" />}
                          Reconectar via QR Code
                        </Button>
                      )}

                      {/* Inline QR for reconnection */}
                      {editingInstance.id && reconnectingInstanceId === editingInstance.id && qrImage && (
                        <div className="flex flex-col items-center gap-3 p-3 rounded-md border bg-background">
                          <p className="text-sm font-medium text-foreground">Escaneie o QR Code para reconectar</p>
                          <img src={qrImage} alt="QR Code" className="w-48 h-48 rounded" />
                          {pairingCode && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Código:</span>
                              <code className="text-sm font-mono font-bold tracking-widest bg-muted px-2 py-1 rounded">{pairingCode}</code>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Aguardando conexão... ({qrCountdown}s)
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={handleReconnectRefreshQr} disabled={qrLoading}>
                              <RefreshCw className="h-3 w-3 mr-1" /> Atualizar QR
                            </Button>
                            <Button size="sm" variant="ghost" onClick={handleCancelReconnect}>
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Reconnecting loading state */}
                      {editingInstance.id && reconnectingInstanceId === editingInstance.id && !qrImage && qrLoading && (
                        <div className="flex items-center justify-center gap-2 p-4">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Obtendo QR Code...</span>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button onClick={handleSaveInstance} disabled={savingInstance} size="sm">
                          {savingInstance ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                          Salvar
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => { setEditingInstance(null); setQrStep('idle'); handleCancelReconnect(); }}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Instances list */}
                  {instances.length === 0 && !editingInstance && (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhuma instância cadastrada</p>
                  )}
                  {instances.map((inst) => {
                    const status = connectionStatus[inst.id];
                    return (
                    <div key={inst.id} className={`flex items-center gap-3 rounded-md border px-3 py-2 ${inst.ativo ? '' : 'opacity-50'}`}>
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <WhatsAppIcon />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-sm truncate">{inst.nome || 'Sem nome'}</span>
                            <Badge variant={inst.ativo ? "default" : "secondary"} className="text-[10px] px-1.5 py-0 shrink-0">
                              {inst.ativo ? 'Ativo' : 'Inativo'}
                            </Badge>
                            {inst.ativo && status === 'connected' && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 border-green-500 text-green-600">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1" />
                                Conectado
                              </Badge>
                            )}
                            {inst.ativo && status === 'disconnected' && (
                              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 shrink-0">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-destructive-foreground mr-1" />
                                Desconectado
                              </Badge>
                            )}
                            {inst.ativo && status === 'checking' && (
                              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                             )}
                            {inst.apenas_lembretes && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 border-amber-500 text-amber-600">
                                Só Lembretes
                              </Badge>
                            )}
                            {inst.robo && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 border-blue-500 text-blue-600">
                                Robô
                              </Badge>
                            )}
                            {inst.ia_responde && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 border-green-500 text-green-600">
                                IA Responde
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">{inst.server_url}</p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <div className="flex items-center gap-1">
                          <Switch
                            checked={inst.ativo}
                            onCheckedChange={(checked) => handleToggleInstance(inst.id, checked)}
                            className="scale-90"
                            title="Ativar/Desativar"
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
                        {inst.ativo && (
                          <div className="flex flex-col gap-1 items-end">
                            <div className="flex items-center gap-1.5">
                              <Label className="text-[10px] text-muted-foreground cursor-pointer" htmlFor={`lembretes-only-${inst.id}`}>
                                Apenas Lembretes
                              </Label>
                              <Checkbox
                                id={`lembretes-only-${inst.id}`}
                                checked={inst.apenas_lembretes}
                                onCheckedChange={(checked) => handleToggleApenasLembretes(inst.id, !!checked)}
                                className="h-3.5 w-3.5"
                              />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Label className="text-[10px] text-muted-foreground cursor-pointer" htmlFor={`robo-${inst.id}`}>
                                Robô
                              </Label>
                              <Checkbox
                                id={`robo-${inst.id}`}
                                checked={inst.robo}
                                onCheckedChange={(checked) => handleToggleRobo(inst.id, !!checked)}
                                className="h-3.5 w-3.5"
                              />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Label className="text-[10px] text-muted-foreground cursor-pointer" htmlFor={`ia-responde-${inst.id}`}>
                                IA Responde
                              </Label>
                              <Checkbox
                                id={`ia-responde-${inst.id}`}
                                checked={inst.ia_responde}
                                onCheckedChange={(checked) => handleToggleIaResponde(inst.id, !!checked)}
                                className="h-3.5 w-3.5"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>


              {isAdmin && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="text-base font-semibold">🔗 Webhook do Chatbot IA</h3>
                    <p className="text-sm text-muted-foreground">
                      Configure este webhook em cada instância UAZAPI para que a IA responda automaticamente.
                    </p>
                    <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                      <Label className="text-xs text-muted-foreground">URL do Webhook</Label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs bg-background rounded px-2 py-1.5 border break-all select-all">
                          {`https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/whatsapp-chatbot`}
                        </code>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => {
                            navigator.clipboard.writeText(`https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/whatsapp-chatbot`);
                            toast.success('URL copiada!');
                          }}
                          title="Copiar URL"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="rounded-md border p-3 space-y-2">
                      <p className="text-sm font-semibold">Passo a passo:</p>
                      <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                        <li>Acesse o painel da UAZAPI da instância desejada</li>
                        <li>Vá em <strong>Configurações</strong> → <strong>Webhook</strong></li>
                        <li>Cole a URL acima no campo de webhook</li>
                        <li>Ative o evento <strong>onMessage</strong> (mensagens recebidas)</li>
                        <li>Salve as configurações</li>
                        <li>Repita para cada instância que deseja usar com a IA</li>
                      </ol>
                    </div>
                  </div>
                </>
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
                <Button onClick={() => handleTestSend()} disabled={sendingTest || !testPhone.trim()}>
                  {sendingTest ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  Testar envio
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog Mensagens de Lembrete */}
        <LembreteMensagensDialog
          open={lembreteMensagensOpen}
          onOpenChange={setLembreteMensagensOpen}
        />

        {/* Chat History Dialog */}
        <ChatHistoryDialog
          open={chatDialogOpen}
          onOpenChange={setChatDialogOpen}
          conversa={selectedConversa}
        />
      </div>
    </AppLayout>
  );
}
