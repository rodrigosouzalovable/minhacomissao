import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Loader2, Upload, Copy, Settings, FileSpreadsheet, Trash2, ShieldCheck, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';
import { CopyButton } from '@/components/CopyButton';
import { EditarTemplateMensagemDialog } from '@/components/EditarTemplateMensagemDialog';
import {
  parsePlanilhaCobmais,
  renderMensagem,
  type ClienteImportado,
} from '@/lib/parseCobmaisPlanilha';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ColarImagemTab } from '@/components/modelo-mensagem/ColarImagemTab';


const TEMPLATE_PADRAO = `Olá, {primeiro_nome}! Tudo bem?

Identificamos {qtd_parcelas_atraso} parcelas em aberto a {dias_atraso} dias de atraso no contrato {contrato}, totalizando *R$ {total_atraso}*.

💰 *Condições especiais para hoje:*

✅ *À VISTA* com {desconto_vista_pct}% de desconto:
   *R$ {valor_quitacao}*

{opcoes_parcelado}

Posso confirmar qual opção é melhor para você?`;

const STORAGE_KEY = 'modelo_mensagem_state_v1';

type WaStatus = 'valido' | 'sem_whatsapp' | 'erro';
type FiltroWa = 'todos' | 'com' | 'sem' | 'nao';

interface PersistedState {
  clientes: ClienteImportado[];
  contatados: string[];
  descVistaGlobal: number;
  descParceladoGlobal: number;
  whatsappStatus?: Record<string, WaStatus>;
}

interface UazInstance {
  id: string;
  nome: string;
  telefone: string | null;
  ativo: boolean;
  server_url: string;
  instance_token: string;
}

// Mesma normalização da edge function check-whatsapp-numbers (prefixo 55)
function normalizeTel(phone: string): string {
  const clean = (phone || '').replace(/\D/g, '');
  if (!clean) return '';
  return clean.startsWith('55') ? clean : `55${clean}`;
}

export default function ModeloMensagem() {
  const { user } = useAuth();
  const [template, setTemplate] = useState(TEMPLATE_PADRAO);
  const [descVistaGlobal, setDescVistaGlobal] = useState(50);
  const [parceladoQtdGlobal, setParceladoQtdGlobal] = useState(12);
  const [descParceladoGlobal, setDescParceladoGlobal] = useState(30);

  // Mensagem 2 (modelo alternativo)
  const [template2, setTemplate2] = useState(TEMPLATE_PADRAO);
  const [descVistaGlobal2, setDescVistaGlobal2] = useState(50);
  const [parceladoQtdGlobal2, setParceladoQtdGlobal2] = useState(12);
  const [descParceladoGlobal2, setDescParceladoGlobal2] = useState(30);

  const [clientes, setClientes] = useState<ClienteImportado[]>([]);
  const [contatados, setContatados] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [lastClicked, setLastClicked] = useState<{ cpf: string; field: 'nome' | 'telefone' | 'mensagem'; value?: string } | null>(null);

  // Validação WhatsApp
  const [whatsappStatus, setWhatsappStatus] = useState<Record<string, WaStatus>>({});
  const [uazInstancias, setUazInstancias] = useState<UazInstance[]>([]);
  const [validadorId, setValidadorId] = useState<string>('');
  const [validando, setValidando] = useState(false);
  const [filtroWa, setFiltroWa] = useState<FiltroWa>('todos');

  const isHighlighted = (cpf: string, field: 'nome' | 'telefone' | 'mensagem', value?: string) =>
    !!lastClicked && lastClicked.cpf === cpf && lastClicked.field === field && (value === undefined || lastClicked.value === value);

  // Hidrata: tenta banco primeiro (sincroniza entre dispositivos); cai pro localStorage como cache.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 1) cache local imediato (evita tela vazia)
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const s = JSON.parse(raw) as PersistedState;
          if (Array.isArray(s.clientes)) {
            const fixed = s.clientes.map((c: any) => ({
              ...c,
              telefones: Array.isArray(c.telefones) ? c.telefones : (c.telefone ? [c.telefone] : []),
            }));
            setClientes(fixed);
          }
          if (Array.isArray(s.contatados)) setContatados(new Set(s.contatados));
          if (typeof s.descVistaGlobal === 'number') setDescVistaGlobal(s.descVistaGlobal);
          if (typeof s.descParceladoGlobal === 'number') setDescParceladoGlobal(s.descParceladoGlobal);
          if (s.whatsappStatus && typeof s.whatsappStatus === 'object') setWhatsappStatus(s.whatsappStatus);
        }
      } catch {}

      // 2) banco (autoritativo)
      if (user) {
        const { data } = await supabase
          .from('modelo_mensagem_estado' as any)
          .select('clientes, contatados, desc_vista_global, desc_parcelado_global, whatsapp_status')
          .eq('user_id', user.id)
          .maybeSingle();
        if (!cancelled && data) {
          const d: any = data;
          if (Array.isArray(d.clientes)) {
            const fixed = d.clientes.map((c: any) => ({
              ...c,
              telefones: Array.isArray(c.telefones) ? c.telefones : (c.telefone ? [c.telefone] : []),
            }));
            setClientes(fixed);
          }
          if (Array.isArray(d.contatados)) setContatados(new Set(d.contatados));
          if (d.desc_vista_global != null) setDescVistaGlobal(Number(d.desc_vista_global));
          if (d.desc_parcelado_global != null) setDescParceladoGlobal(Number(d.desc_parcelado_global));
          if (d.whatsapp_status && typeof d.whatsapp_status === 'object') setWhatsappStatus(d.whatsapp_status);
        }
      }
      if (!cancelled) setHydrated(true);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Carrega instâncias UAZAPI conectadas do usuário (para validar WhatsApp)
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any)
        .from('user_whatsapp_instances')
        .select('id, nome, telefone, ativo, server_url, instance_token')
        .eq('ativo', true)
        .order('nome');
      if (data) setUazInstancias(data as UazInstance[]);
    })();
  }, [user]);

  // Persiste no localStorage (cache rápido) + banco (debounce 600ms)
  useEffect(() => {
    if (!hydrated) return;
    const s: PersistedState = {
      clientes,
      contatados: Array.from(contatados),
      descVistaGlobal,
      descParceladoGlobal,
      whatsappStatus,
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}

    if (!user) return;
    const t = setTimeout(() => {
      supabase
        .from('modelo_mensagem_estado' as any)
        .upsert({
          user_id: user.id,
          clientes: clientes as any,
          contatados: Array.from(contatados) as any,
          desc_vista_global: descVistaGlobal,
          desc_parcelado_global: descParceladoGlobal,
          whatsapp_status: whatsappStatus as any,
          atualizado_em: new Date().toISOString(),
        }, { onConflict: 'user_id' })
        .then(({ error }) => { if (error) console.error('[modelo_mensagem_estado] upsert', error); });
    }, 600);
    return () => clearTimeout(t);
  }, [clientes, contatados, descVistaGlobal, descParceladoGlobal, whatsappStatus, hydrated, user]);


  // Carrega template salvo do usuário
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('modelo_mensagem_template' as any)
        .select('template, desconto_padrao, desconto_parcelado_padrao, parcelas_padrao, template_2, desconto_padrao_2, desconto_parcelado_padrao_2, parcelas_padrao_2')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        const d = data as any;
        if (d.template) setTemplate(d.template);
        if (d.parcelas_padrao != null) setParceladoQtdGlobal(Number(d.parcelas_padrao));
        if (d.desconto_parcelado_padrao != null) setDescParceladoGlobal(Number(d.desconto_parcelado_padrao));
        if (d.desconto_padrao != null) setDescVistaGlobal(Number(d.desconto_padrao));
        if (d.template_2) setTemplate2(d.template_2);
        else if (d.template) setTemplate2(d.template);
        if (d.parcelas_padrao_2 != null) setParceladoQtdGlobal2(Number(d.parcelas_padrao_2));
        else if (d.parcelas_padrao != null) setParceladoQtdGlobal2(Number(d.parcelas_padrao));
        if (d.desconto_parcelado_padrao_2 != null) setDescParceladoGlobal2(Number(d.desconto_parcelado_padrao_2));
        else if (d.desconto_parcelado_padrao != null) setDescParceladoGlobal2(Number(d.desconto_parcelado_padrao));
        if (d.desconto_padrao_2 != null) setDescVistaGlobal2(Number(d.desconto_padrao_2));
        else if (d.desconto_padrao != null) setDescVistaGlobal2(Number(d.desconto_padrao));
      }
    })();
  }, [user]);

  const handleFile = async (file: File) => {
    setLoading(true);
    try {
      const lista = await parsePlanilhaCobmais(file);
      if (lista.length === 0) {
        toast.warning('Nenhum cliente encontrado na planilha.');
      } else {
        toast.success(`${lista.length} cliente(s) importado(s).`);
      }
      setClientes(lista);
      setContatados(new Set());
      setWhatsappStatus({});
      setFiltroWa('todos');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao ler planilha');
    } finally {
      setLoading(false);
    }
  };

  const limparLista = () => {
    if (!confirm('Limpar a lista importada e os marcadores de contato?')) return;
    setClientes([]);
    setContatados(new Set());
    setWhatsappStatus({});
    setFiltroWa('todos');
    toast.success('Lista limpa.');
  };

  const limparValidacao = () => {
    if (!confirm('Limpar a verificação de WhatsApp (mantém a lista de clientes)?')) return;
    setWhatsappStatus({});
    setFiltroWa('todos');
    toast.success('Verificação limpa.');
  };

  const verificarWhatsApp = async () => {
    if (clientes.length === 0) return toast.error('Importe uma planilha primeiro');
    if (!validadorId) return toast.error('Selecione uma instância validadora');
    const validador = uazInstancias.find((x) => x.id === validadorId);
    if (!validador) return toast.error('Instância validadora inválida');

    // coleta todos os telefones únicos (normalizados)
    const telSet = new Set<string>();
    for (const c of clientes) {
      const tels = c.telefones?.length ? c.telefones : (c.telefone ? [c.telefone] : []);
      tels.forEach((t) => { const n = normalizeTel(t); if (n) telSet.add(n); });
    }
    const numeros = Array.from(telSet);
    if (numeros.length === 0) return toast.error('Nenhum telefone para verificar');

    setValidando(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-whatsapp-numbers', {
        body: {
          numbers: numeros,
          server_url: validador.server_url,
          instance_token: validador.instance_token,
        },
      });
      if (error) throw error;

      const novo: Record<string, WaStatus> = { ...whatsappStatus };
      const validos: string[] = (data?.valid || []).map((n: string) => normalizeTel(String(n)));
      const invalidos: string[] = (data?.invalid || []).map((n: string) => normalizeTel(String(n)));
      const erros: string[] = (data?.errors || []).map((n: string) => normalizeTel(String(n)));
      validos.forEach((n) => { if (n) novo[n] = 'valido'; });
      invalidos.forEach((n) => { if (n) novo[n] = 'sem_whatsapp'; });
      erros.forEach((n) => { if (n) novo[n] = 'erro'; });
      setWhatsappStatus(novo);

      toast.success(
        `Verificação concluída — ✅ ${validos.length} com WhatsApp · ❌ ${invalidos.length} sem · ⚠️ ${erros.length} erro`
      );
    } catch (e: any) {
      toast.error('Erro na verificação: ' + (e?.message || e));
    } finally {
      setValidando(false);
    }
  };

  const toggleContatado = (cpf: string) => {
    setContatados((prev) => {
      const n = new Set(prev);
      if (n.has(cpf)) n.delete(cpf);
      else n.add(cpf);
      return n;
    });
  };

  const mensagemDoCliente = (c: ClienteImportado, qual: 1 | 2 = 1) =>
    renderMensagem(qual === 2 ? template2 : template, {
      cliente: c,
      descontoVistaPct: qual === 2 ? descVistaGlobal2 : descVistaGlobal,
      parceladoQtd: qual === 2 ? parceladoQtdGlobal2 : parceladoQtdGlobal,
      descontoParceladoPct: qual === 2 ? descParceladoGlobal2 : descParceladoGlobal,
    });

  const copiarMsg = async (c: ClienteImportado, qual: 1 | 2 = 1) => {
    await navigator.clipboard.writeText(mensagemDoCliente(c, qual));
    setLastClicked({ cpf: c.cpf, field: 'mensagem' });
    toast.success(`Mensagem ${qual} de ${c.nome.split(' ')[0]} copiada!`);
  };

  const copiarNome = async (c: ClienteImportado) => {
    await navigator.clipboard.writeText(c.nome);
    setLastClicked({ cpf: c.cpf, field: 'nome' });
    toast.success('Nome copiado!');
  };

  const copiarTel = async (cpf: string, tel: string) => {
    await navigator.clipboard.writeText(tel);
    setLastClicked({ cpf, field: 'telefone', value: tel });
    toast.success('Telefone copiado!');
  };

  const totalContatados = useMemo(
    () => clientes.filter((c) => contatados.has(c.cpf)).length,
    [clientes, contatados],
  );

  // Classifica cliente pelo "melhor status" entre seus telefones
  const statusDoCliente = (c: ClienteImportado): WaStatus | 'desconhecido' => {
    const tels = c.telefones?.length ? c.telefones : (c.telefone ? [c.telefone] : []);
    let temValido = false, temSem = false, temErro = false, temDesc = false;
    for (const t of tels) {
      const s = whatsappStatus[normalizeTel(t)];
      if (s === 'valido') temValido = true;
      else if (s === 'sem_whatsapp') temSem = true;
      else if (s === 'erro') temErro = true;
      else temDesc = true;
    }
    if (temValido) return 'valido';
    if (temDesc && !temSem && !temErro) return 'desconhecido';
    if (temSem) return 'sem_whatsapp';
    if (temErro) return 'erro';
    return 'desconhecido';
  };

  const { totalComWa, totalSemWa, totalNaoVerificados } = useMemo(() => {
    let com = 0, sem = 0, nao = 0;
    for (const c of clientes) {
      const s = statusDoCliente(c);
      if (s === 'valido') com++;
      else if (s === 'sem_whatsapp') sem++;
      else nao++;
    }
    return { totalComWa: com, totalSemWa: sem, totalNaoVerificados: nao };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientes, whatsappStatus]);

  const clientesFiltrados = useMemo(() => {
    if (filtroWa === 'todos') return clientes;
    return clientes.filter((c) => {
      const s = statusDoCliente(c);
      if (filtroWa === 'com') return s === 'valido';
      if (filtroWa === 'sem') return s === 'sem_whatsapp';
      if (filtroWa === 'nao') return s !== 'valido' && s !== 'sem_whatsapp';
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientes, filtroWa, whatsappStatus]);

  const houveVerificacao = Object.keys(whatsappStatus).length > 0;

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold">Modelo Mensagem</h1>
            <p className="text-sm text-muted-foreground">
              Importe a planilha do Cob+ e gere as mensagens de negociação para cada cliente.
            </p>
          </div>
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Settings className="h-4 w-4 mr-2" /> Editar Modelo
          </Button>
        </div>

        <Tabs defaultValue="planilha" className="w-full">
          <TabsList>
            <TabsTrigger value="planilha">Importar planilha</TabsTrigger>
            <TabsTrigger value="imagem">Colar imagem</TabsTrigger>
          </TabsList>

          <TabsContent value="planilha" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">1. Importar planilha</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <input
                    id="xlsx-input"
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  />
                  <Button
                    onClick={() => document.getElementById('xlsx-input')?.click()}
                    disabled={loading}
                  >
                    {loading
                      ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      : <Upload className="h-4 w-4 mr-2" />}
                    Selecionar arquivo .xlsx
                  </Button>
                  {clientes.length > 0 && (
                    <>
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <FileSpreadsheet className="h-4 w-4" />
                        {clientes.length} cliente(s) • {totalContatados} contatado(s)
                        {houveVerificacao && (
                          <>
                            {' '}• <span className="text-emerald-600 font-medium">✅ {totalComWa} com WA</span>
                            {' '}• <span className="text-red-600 font-medium">❌ {totalSemWa} sem WA</span>
                            {totalNaoVerificados > 0 && <> {' '}• {totalNaoVerificados} não verif.</>}
                          </>
                        )}
                      </span>
                      <Button variant="ghost" size="sm" onClick={limparLista}>
                        <Trash2 className="h-4 w-4 mr-1" /> Limpar lista
                      </Button>
                      {houveVerificacao && (
                        <Button variant="ghost" size="sm" onClick={limparValidacao}>
                          <Trash2 className="h-4 w-4 mr-1" /> Limpar verificação
                        </Button>
                      )}
                    </>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t">
                  <div>
                    <Label className="text-xs">% Desconto à vista</Label>
                    <Input type="number" min={0} max={100}
                      value={descVistaGlobal}
                      onChange={(e) => setDescVistaGlobal(Number(e.target.value))} />
                  </div>
                  <div>
                    <Label className="text-xs">% Desconto parcelado</Label>
                    <Input type="number" min={0} max={100}
                      value={descParceladoGlobal}
                      onChange={(e) => setDescParceladoGlobal(Number(e.target.value))} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  As mensagens são atualizadas automaticamente ao alterar os descontos. Parcelamento exibe 4x, 8x, 12x e 15x — opções com parcela menor que R$100 são ocultadas.
                </p>

                {clientes.length > 0 && (
                  <div className="pt-3 border-t space-y-2">
                    <Label className="text-xs flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5" /> Verificar quem tem WhatsApp (opcional)
                    </Label>
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="flex-1 min-w-[260px]">
                        <Select value={validadorId || '__none__'} onValueChange={(v) => setValidadorId(v === '__none__' ? '' : v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma instância UAZAPI conectada" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Selecione uma instância…</SelectItem>
                            {uazInstancias.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.nome} {u.telefone ? `• ${u.telefone}` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={verificarWhatsApp} disabled={validando || !validadorId}>
                        {validando
                          ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          : <ShieldCheck className="h-4 w-4 mr-2" />}
                        Verificar WhatsApp
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Usa a UAZAPI para identificar quais telefones têm WhatsApp. Os que não têm aparecem em <span className="text-red-600 font-medium">vermelho</span> e podem ser filtrados na lista abaixo.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {clientes.length > 0 && (
              <Card>
                <CardHeader className="space-y-3">
                  <CardTitle className="text-base">2. Clientes & Propostas</CardTitle>
                  {houveVerificacao && (
                    <div className="flex flex-wrap gap-2">
                      {([
                        { v: 'todos', label: `Todos (${clientes.length})` },
                        { v: 'com', label: `✅ Com WhatsApp (${totalComWa})` },
                        { v: 'sem', label: `❌ Sem WhatsApp (${totalSemWa})` },
                        { v: 'nao', label: `Não verificados (${totalNaoVerificados})` },
                      ] as { v: FiltroWa; label: string }[]).map((opt) => (
                        <Button
                          key={opt.v}
                          size="sm"
                          variant={filtroWa === opt.v ? 'default' : 'outline'}
                          onClick={() => setFiltroWa(opt.v)}
                        >
                          {opt.label}
                        </Button>
                      ))}
                    </div>
                  )}
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[80px]">Contatado</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Telefone(s)</TableHead>
                        <TableHead className="min-w-[360px]">Mensagens</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clientesFiltrados.map((c) => {
                        const msg1 = mensagemDoCliente(c, 1);
                        const msg2 = mensagemDoCliente(c, 2);
                        const isContatado = contatados.has(c.cpf);
                        const tels = c.telefones?.length ? c.telefones : (c.telefone ? [c.telefone] : []);
                        return (
                          <TableRow
                            key={c.cpf}
                            className={`cursor-pointer hover:bg-muted/50 ${isContatado ? 'bg-emerald-100 hover:bg-emerald-200/60' : ''}`}
                            onClick={(e) => {
                              if ((e.target as HTMLElement).closest('button, input, label')) return;
                              toggleContatado(c.cpf);
                            }}
                          >
                            <TableCell className="align-top">
                              <Checkbox
                                checked={isContatado}
                                onCheckedChange={() => toggleContatado(c.cpf)}
                              />
                            </TableCell>
                            <TableCell className={`font-medium align-top ${isContatado ? 'line-through' : ''}`}>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`cursor-pointer hover:underline hover:text-emerald-600 rounded px-1 -mx-1 ${isHighlighted(c.cpf, 'nome') ? 'animate-pulse-slow' : ''}`}
                                  onClick={(e) => { e.stopPropagation(); copiarNome(c); }}
                                  title="Clique para copiar o nome"
                                >
                                  {c.nome}
                                </span>
                                <CopyButton value={c.nome} label="Nome" preserveText />
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-base align-top">
                              {tels.length > 0 ? (
                                <div className="flex flex-col gap-1">
                                  {tels.map((t) => {
                                    const status = whatsappStatus[normalizeTel(t)];
                                    const isSem = status === 'sem_whatsapp';
                                    const isValido = status === 'valido';
                                    const isErro = status === 'erro';
                                    const corTel = isSem
                                      ? 'text-red-600 line-through'
                                      : isValido
                                      ? 'text-emerald-700'
                                      : isErro
                                      ? 'text-amber-600'
                                      : '';
                                    const titleTel = isSem
                                      ? 'Sem WhatsApp'
                                      : isValido
                                      ? 'Tem WhatsApp'
                                      : isErro
                                      ? 'Erro ao verificar'
                                      : 'Clique para copiar';
                                    return (
                                      <div key={t} className="flex items-center gap-2">
                                        {isValido && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
                                        {isSem && <XCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />}
                                        {isErro && <HelpCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />}
                                        <span
                                          className={`cursor-pointer hover:underline font-bold rounded px-1 -mx-1 ${corTel} ${isHighlighted(c.cpf, 'telefone', t) ? 'animate-pulse-slow' : ''}`}
                                          onClick={(e) => { e.stopPropagation(); copiarTel(c.cpf, t); }}
                                          title={titleTel}
                                        >
                                          {t}
                                        </span>
                                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); copiarTel(c.cpf, t); }} title="Copiar telefone">
                                          <Copy className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="align-top">
                              <div className="flex flex-col gap-2">
                                <div className="flex items-start gap-2">
                                  <span className="text-[10px] font-bold uppercase text-muted-foreground mt-1 shrink-0">Msg 1</span>
                                  <div
                                    className={`text-xs whitespace-pre-wrap line-clamp-3 max-w-[460px] text-muted-foreground flex-1 cursor-pointer rounded px-1 -mx-1 hover:text-foreground ${isHighlighted(c.cpf, 'mensagem') ? 'animate-pulse-slow' : ''}`}
                                    title={msg1}
                                    onClick={(e) => { e.stopPropagation(); copiarMsg(c, 1); }}
                                  >
                                    {msg1}
                                  </div>
                                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={(e) => { e.stopPropagation(); copiarMsg(c, 1); }} title="Copiar Mensagem 1">
                                    <Copy className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                                <div className="flex items-start gap-2 border-t pt-2">
                                  <span className="text-[10px] font-bold uppercase text-muted-foreground mt-1 shrink-0">Msg 2</span>
                                  <div
                                    className="text-xs whitespace-pre-wrap line-clamp-3 max-w-[460px] text-muted-foreground flex-1 cursor-pointer rounded px-1 -mx-1 hover:text-foreground"
                                    title={msg2}
                                    onClick={(e) => { e.stopPropagation(); copiarMsg(c, 2); }}
                                  >
                                    {msg2}
                                  </div>
                                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={(e) => { e.stopPropagation(); copiarMsg(c, 2); }} title="Copiar Mensagem 2">
                                    <Copy className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="imagem" className="mt-4">
            <ColarImagemTab
              template={template}
              descVistaGlobal={descVistaGlobal}
              descParceladoGlobal={descParceladoGlobal}
              parceladoQtdGlobal={parceladoQtdGlobal}
            />
          </TabsContent>
        </Tabs>


        <EditarTemplateMensagemDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          template={template}
          descontoPadrao={descVistaGlobal}
          descontoParceladoPadrao={descParceladoGlobal}
          parcelasPadrao={parceladoQtdGlobal}
          onSaved={(t, d, dp, p) => { setTemplate(t); setDescVistaGlobal(d); setDescParceladoGlobal(dp); setParceladoQtdGlobal(p); }}
        />
      </div>
    </AppLayout>
  );
}
