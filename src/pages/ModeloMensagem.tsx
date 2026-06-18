import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Loader2, Upload, Copy, Settings, FileSpreadsheet } from 'lucide-react';
import { EditarTemplateMensagemDialog } from '@/components/EditarTemplateMensagemDialog';
import {
  parsePlanilhaCobmais,
  renderMensagem,
  type ClienteImportado,
} from '@/lib/parseCobmaisPlanilha';

const TEMPLATE_PADRAO = `Olá, {primeiro_nome}! Tudo bem?

Identificamos {qtd_parcelas_atraso} parcelas em aberto a {dias_atraso} dias de atraso no contrato {contrato}, totalizando *R$ {total_atraso}*.

📋 *Parcelas em aberto:*
{lista_parcelas}

💰 *Condições especiais para hoje:*

✅ *À VISTA* com {desconto_vista_pct}% de desconto:
   *R$ {valor_quitacao}*

✅ *PARCELADO* em {parcelado_qtd}x de {valor_cada_parcela_proposta}
   (total R$ {valor_parcelado_total}, {desconto_parcelado_pct}% de desconto)

Posso confirmar qual opção é melhor para você?`;

interface LinhaConfig {
  descontoVistaPct: number;
  parceladoQtd: number;
  descontoParceladoPct: number;
}

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ModeloMensagem() {
  const { user } = useAuth();
  const [template, setTemplate] = useState(TEMPLATE_PADRAO);
  const [descVistaGlobal, setDescVistaGlobal] = useState(50);
  const [parceladoQtdGlobal, setParceladoQtdGlobal] = useState(12);
  const [descParceladoGlobal, setDescParceladoGlobal] = useState(30);

  const [clientes, setClientes] = useState<ClienteImportado[]>([]);
  const [configs, setConfigs] = useState<Record<string, LinhaConfig>>({});
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  

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
        if (d.desconto_padrao != null) setDescVistaGlobal(Number(d.desconto_padrao));
        if (d.parcelas_padrao != null) setParceladoQtdGlobal(Number(d.parcelas_padrao));
      }
    })();
  }, [user]);

  const PARCELA_MINIMA = 100;
  const calcMaxParcelas = (total: number, descPct: number, desejado: number) => {
    const valor = total * (1 - (descPct || 0) / 100);
    const max = Math.max(1, Math.floor(valor / PARCELA_MINIMA));
    return Math.max(1, Math.min(desejado || 1, max));
  };

  const aplicarGlobaisATodos = () => {
    const novo: Record<string, LinhaConfig> = {};
    for (const c of clientes) {
      novo[c.cpf] = {
        descontoVistaPct: descVistaGlobal,
        parceladoQtd: calcMaxParcelas(c.totalAtraso, descParceladoGlobal, parceladoQtdGlobal),
        descontoParceladoPct: descParceladoGlobal,
      };
    }
    setConfigs(novo);
    toast.success('Configurações aplicadas a todos os clientes.');
  };

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
      const cfg: Record<string, LinhaConfig> = {};
      for (const c of lista) {
        cfg[c.cpf] = {
          descontoVistaPct: descVistaGlobal,
          parceladoQtd: calcMaxParcelas(c.totalAtraso, descParceladoGlobal, parceladoQtdGlobal),
          descontoParceladoPct: descParceladoGlobal,
        };
      }
      setConfigs(cfg);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao ler planilha');
    } finally {
      setLoading(false);
    }
  };

  const setLinhaCfg = (cpf: string, patch: Partial<LinhaConfig>) => {
    setConfigs((prev) => {
      const cur = prev[cpf] ?? {
        descontoVistaPct: descVistaGlobal,
        parceladoQtd: parceladoQtdGlobal,
        descontoParceladoPct: descParceladoGlobal,
      };
      const next = { ...cur, ...patch };
      const cliente = clientes.find((x) => x.cpf === cpf);
      if (cliente && (patch.parceladoQtd !== undefined || patch.descontoParceladoPct !== undefined)) {
        next.parceladoQtd = calcMaxParcelas(cliente.totalAtraso, next.descontoParceladoPct, next.parceladoQtd);
      }
      return { ...prev, [cpf]: next };
    });
  };

  const mensagemDoCliente = (c: ClienteImportado) => {
    const cfg = configs[c.cpf] ?? {
      descontoVistaPct: descVistaGlobal,
      parceladoQtd: calcMaxParcelas(c.totalAtraso, descParceladoGlobal, parceladoQtdGlobal),
      descontoParceladoPct: descParceladoGlobal,
    };
    return renderMensagem(template, { cliente: c, ...cfg });
  };

  const copiar = async (c: ClienteImportado) => {
    await navigator.clipboard.writeText(mensagemDoCliente(c));
    toast.success(`Mensagem de ${c.nome.split(' ')[0]} copiada!`);
  };

  const clientePreview = useMemo(
    () => clientes.find((c) => c.cpf === previewCpf) || null,
    [clientes, previewCpf],
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
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <FileSpreadsheet className="h-4 w-4" />
                  {clientes.length} cliente(s) importado(s)
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-3 border-t">
              <div>
                <Label className="text-xs">% Desconto à vista</Label>
                <Input type="number" min={0} max={100}
                  value={descVistaGlobal}
                  onChange={(e) => setDescVistaGlobal(Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">Nº parcelas (parcelado)</Label>
                <Input type="number" min={1} max={60}
                  value={parceladoQtdGlobal}
                  onChange={(e) => setParceladoQtdGlobal(Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">% Desconto parcelado</Label>
                <Input type="number" min={0} max={100}
                  value={descParceladoGlobal}
                  onChange={(e) => setDescParceladoGlobal(Number(e.target.value))} />
              </div>
              <div className="flex items-end">
                <Button variant="secondary" className="w-full"
                  disabled={clientes.length === 0}
                  onClick={aplicarGlobaisATodos}>
                  Aplicar a todos
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Esses valores são aplicados como padrão a cada cliente. Você pode editar linha a linha na tabela abaixo.
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
                    <TableHead>Cliente</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead className="min-w-[320px]">Mensagem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientes.map((c) => {
                    const msg = mensagemDoCliente(c);
                    const copiarTel = async () => {
                      if (!c.telefone) return;
                      await navigator.clipboard.writeText(c.telefone);
                      toast.success('Telefone copiado!');
                    };
                    return (
                      <TableRow key={c.cpf}>
                        <TableCell className="font-medium align-top">{c.nome}</TableCell>
                        <TableCell className="font-mono text-xs align-top">
                          {c.telefone ? (
                            <div className="flex items-center gap-2">
                              <span>{c.telefone}</span>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={copiarTel} title="Copiar telefone">
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
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
                            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => copiar(c)} title="Copiar mensagem">
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
