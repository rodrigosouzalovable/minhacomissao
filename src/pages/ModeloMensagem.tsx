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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Loader2, Upload, Copy, Settings, FileSpreadsheet, Trash2 } from 'lucide-react';
import { CopyButton } from '@/components/CopyButton';
import { EditarTemplateMensagemDialog } from '@/components/EditarTemplateMensagemDialog';
import {
  parsePlanilhaCobmais,
  renderMensagem,
  type ClienteImportado,
} from '@/lib/parseCobmaisPlanilha';

const TEMPLATE_PADRAO = `Olá, {primeiro_nome}! Tudo bem?

Identificamos {qtd_parcelas_atraso} parcelas em aberto a {dias_atraso} dias de atraso no contrato {contrato}, totalizando *R$ {total_atraso}*.

💰 *Condições especiais para hoje:*

✅ *À VISTA* com {desconto_vista_pct}% de desconto:
   *R$ {valor_quitacao}*

{opcoes_parcelado}

Posso confirmar qual opção é melhor para você?`;

const STORAGE_KEY = 'modelo_mensagem_state_v1';

interface PersistedState {
  clientes: ClienteImportado[];
  contatados: string[];
  descVistaGlobal: number;
  descParceladoGlobal: number;
}

export default function ModeloMensagem() {
  const { user } = useAuth();
  const [template, setTemplate] = useState(TEMPLATE_PADRAO);
  const [descVistaGlobal, setDescVistaGlobal] = useState(50);
  const [parceladoQtdGlobal, setParceladoQtdGlobal] = useState(12);
  const [descParceladoGlobal, setDescParceladoGlobal] = useState(30);

  const [clientes, setClientes] = useState<ClienteImportado[]>([]);
  const [contatados, setContatados] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hidrata do localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as PersistedState;
        if (Array.isArray(s.clientes)) {
          // backfill telefones[] em dados antigos
          const fixed = s.clientes.map((c: any) => ({
            ...c,
            telefones: Array.isArray(c.telefones) ? c.telefones : (c.telefone ? [c.telefone] : []),
          }));
          setClientes(fixed);
        }
        if (Array.isArray(s.contatados)) setContatados(new Set(s.contatados));
        if (typeof s.descVistaGlobal === 'number') setDescVistaGlobal(s.descVistaGlobal);
        if (typeof s.descParceladoGlobal === 'number') setDescParceladoGlobal(s.descParceladoGlobal);
      }
    } catch {}
    setHydrated(true);
  }, []);

  // Persiste no localStorage
  useEffect(() => {
    if (!hydrated) return;
    try {
      const s: PersistedState = {
        clientes,
        contatados: Array.from(contatados),
        descVistaGlobal,
        descParceladoGlobal,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {}
  }, [clientes, contatados, descVistaGlobal, descParceladoGlobal, hydrated]);

  // Carrega template salvo do usuário
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('modelo_mensagem_template' as any)
        .select('template, desconto_padrao, parcelas_padrao')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        const d = data as any;
        if (d.template) setTemplate(d.template);
        if (d.parcelas_padrao != null) setParceladoQtdGlobal(Number(d.parcelas_padrao));
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
    toast.success('Lista limpa.');
  };

  const toggleContatado = (cpf: string) => {
    setContatados((prev) => {
      const n = new Set(prev);
      if (n.has(cpf)) n.delete(cpf);
      else n.add(cpf);
      return n;
    });
  };

  const mensagemDoCliente = (c: ClienteImportado) =>
    renderMensagem(template, {
      cliente: c,
      descontoVistaPct: descVistaGlobal,
      parceladoQtd: parceladoQtdGlobal,
      descontoParceladoPct: descParceladoGlobal,
    });

  const copiarMsg = async (c: ClienteImportado) => {
    await navigator.clipboard.writeText(mensagemDoCliente(c));
    toast.success(`Mensagem de ${c.nome.split(' ')[0]} copiada!`);
  };

  const copiarTel = async (tel: string) => {
    await navigator.clipboard.writeText(tel);
    toast.success('Telefone copiado!');
  };

  const totalContatados = useMemo(
    () => clientes.filter((c) => contatados.has(c.cpf)).length,
    [clientes, contatados],
  );

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
                  </span>
                  <Button variant="ghost" size="sm" onClick={limparLista}>
                    <Trash2 className="h-4 w-4 mr-1" /> Limpar lista
                  </Button>
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
          </CardContent>
        </Card>

        {clientes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">2. Clientes & Propostas</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Contatado</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Telefone(s)</TableHead>
                    <TableHead className="min-w-[320px]">Mensagem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientes.map((c) => {
                    const msg = mensagemDoCliente(c);
                    const isContatado = contatados.has(c.cpf);
                    const tels = c.telefones?.length ? c.telefones : (c.telefone ? [c.telefone] : []);
                    return (
                      <TableRow
                        key={c.cpf}
                        className={`cursor-pointer hover:bg-muted/50 ${isContatado ? 'opacity-50' : ''}`}
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
                            {c.nome}
                            <CopyButton value={c.nome} label="Nome" preserveText />
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs align-top">
                          {tels.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              {tels.map((t) => (
                                <div key={t} className="flex items-center gap-2">
                                  <span>{t}</span>
                                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copiarTel(t)} title="Copiar telefone">
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex items-start gap-2">
                            <div
                              className="text-xs whitespace-pre-wrap line-clamp-3 max-w-[520px] text-muted-foreground flex-1"
                              title={msg}
                            >
                              {msg}
                            </div>
                            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => copiarMsg(c)} title="Copiar mensagem">
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
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

        <EditarTemplateMensagemDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          template={template}
          descontoPadrao={descVistaGlobal}
          parcelasPadrao={parceladoQtdGlobal}
          onSaved={(t, d, p) => { setTemplate(t); setDescVistaGlobal(d); setParceladoQtdGlobal(p); }}
        />
      </div>
    </AppLayout>
  );
}
