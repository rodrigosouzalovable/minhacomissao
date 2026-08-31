import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, RefreshCw, Copy, Send } from 'lucide-react';
import { toast } from 'sonner';

interface Parcela { parcelas: number; valorParcela: number }
interface Tabela { parcelas: Parcela[]; totalAte3x: number | null; total4xMais: number | null }
interface Consulta {
  encontrado: boolean;
  cpf: string;
  borrowerId: string;
  telefone: string;
  nome: string;
  diasAtraso: number | null;
  fase: string;
  limiteTotal: number | null;
  valorSemJuros: number | null;
  valorComJuros: number | null;
  padrao: Tabela;
  especial: Tabela;
}

const fmt = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });

const soDigitos = (v: string) => (v || '').replace(/\D/g, '');
const formatCpf = (d: string) =>
  d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : d;

type TabelaKey = 'padrao' | 'especial' | 'sem_juros_10';

const PARCELAS_SEM_JUROS_10 = [1, 2, 4, 8, 10, 12, 18];

const round2 = (v: number) => Math.round(v * 100) / 100;

function baseSemJuros10(c: Consulta): number | null {
  return c.valorSemJuros == null ? null : round2(c.valorSemJuros * 1.1);
}

function tabelaSemJuros10(c: Consulta): Tabela | null {
  const base = baseSemJuros10(c);
  if (base == null) return null;
  return {
    parcelas: PARCELAS_SEM_JUROS_10.map((n) => ({ parcelas: n, valorParcela: round2(base / n) })),
    totalAte3x: null,
    total4xMais: null,
  };
}

function tabelaDe(c: Consulta, tabela: TabelaKey): Tabela | null {
  if (tabela === 'especial') return c.especial;
  if (tabela === 'sem_juros_10') return tabelaSemJuros10(c);
  return c.padrao;
}

function textoProposta(c: Consulta, tabela: TabelaKey) {
  const t = tabelaDe(c, tabela);
  if (!t) return '';

  const avista = t.parcelas.find((p) => p.parcelas === 1)?.valorParcela ?? null;
  const total = tabela === 'sem_juros_10' ? baseSemJuros10(c) : (c.valorComJuros ?? c.valorSemJuros ?? null);
  const opcoes = t.parcelas.filter((p) => p.parcelas >= 2 && p.valorParcela >= 100);
  const nome = (c.nome || '').split(' ')[0];
  return [
    `Olá${nome ? `, ${nome}` : ''}! Localizei seu débito${total ? ` no valor total de ${fmt(total)}` : ''}.`,
    '',
    `💵 *À vista:* ${fmt(avista)}`,
    opcoes.length ? '' : null,
    opcoes.length ? '📄 *Parcelado:*' : null,
    ...opcoes.map((p) => `• ${p.parcelas}x de ${fmt(p.valorParcela)}`),
    '',
    'Qual opção fica melhor para você?',
  ].filter((l) => l !== null).join('\n');
}

export function ConsultaUmeDialog({
  open,
  onOpenChange,
  cpfInicial,
  onEnviar,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cpfInicial?: string | null;
  onEnviar?: (texto: string) => void;
}) {
  const [cpf, setCpf] = useState('');
  const [loading, setLoading] = useState(false);
  const [consulta, setConsulta] = useState<Consulta | null>(null);
  const [tabela, setTabela] = useState<TabelaKey>('padrao');
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!open) return;
    const inicial = soDigitos(cpfInicial || '');
    setCpf(inicial);
    setConsulta(null);
    setErro('');
    if (inicial.length === 11) void consultar(inicial, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cpfInicial]);

  const consultar = async (valor: string, forcar: boolean) => {
    const digitos = soDigitos(valor);
    if (digitos.length !== 11) {
      toast.error('Informe um CPF com 11 dígitos');
      return;
    }
    setLoading(true);
    setErro('');
    try {
      const { data, error } = await supabase.functions.invoke('consultar-ume-desconto', {
        body: { cpf: digitos, forcar },
      });
      if (error) throw error;
      if ((data as any)?.error === 'layout_ume_mudou') {
        setErro('O layout do relatório da UME mudou. O administrador já foi avisado.');
        setConsulta(null);
        return;
      }
      if (!(data as any)?.success) throw new Error((data as any)?.error || 'Falha na consulta');
      const c = (data as any).consulta as Consulta;
      if ((data as any).tabelaPadraoConfig) setTabela((data as any).tabelaPadraoConfig);
      setConsulta(c);
      if (!c.encontrado) setErro('CPF não localizado na base da UME.');
    } catch (e) {
      setErro(String((e as Error)?.message || e));
      setConsulta(null);
    } finally {
      setLoading(false);
    }
  };

  const t = consulta ? tabelaDe(consulta, tabela) : null;
  const base10 = consulta ? baseSemJuros10(consulta) : null;


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Consulta UME — calculadora de desconto</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Input
            value={formatCpf(soDigitos(cpf))}
            onChange={(e) => setCpf(soDigitos(e.target.value).slice(0, 11))}
            onKeyDown={(e) => { if (e.key === 'Enter') void consultar(cpf, false); }}
            placeholder="000.000.000-00"
            className="max-w-[190px]"
          />
          <Button onClick={() => void consultar(cpf, false)} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            <span className="ml-2">Consultar</span>
          </Button>
          {consulta?.encontrado && (
            <Button variant="outline" onClick={() => void consultar(cpf, true)} disabled={loading} title="Atualizar ignorando o cache">
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>

        {erro && <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm">{erro}</div>}

        {consulta?.encontrado && t && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 text-sm">
              <div><div className="text-xs text-muted-foreground">Nome</div><div className="font-medium">{consulta.nome || '—'}</div></div>
              <div><div className="text-xs text-muted-foreground">ID</div><div className="font-medium">{consulta.borrowerId || '—'}</div></div>
              <div><div className="text-xs text-muted-foreground">Telefone</div><div className="font-medium">{consulta.telefone || '—'}</div></div>
              <div><div className="text-xs text-muted-foreground">Atraso</div><div className="font-medium">{consulta.diasAtraso ?? '—'} dias</div></div>
              <div className="col-span-2"><div className="text-xs text-muted-foreground">Fase</div><div className="font-medium">{consulta.fase || '—'}</div></div>
              <div><div className="text-xs text-muted-foreground">Limite total</div><div className="font-medium">{fmt(consulta.limiteTotal)}</div></div>
              <div><div className="text-xs text-muted-foreground">Total sem juros</div><div className="font-medium">{fmt(consulta.valorSemJuros)}</div></div>
              <div><div className="text-xs text-muted-foreground">Total com juros</div><div className="font-medium">{fmt(consulta.valorComJuros)}</div></div>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" variant={tabela === 'padrao' ? 'default' : 'outline'} onClick={() => setTabela('padrao')}>Tabela Padrão</Button>
              <Button size="sm" variant={tabela === 'especial' ? 'default' : 'outline'} onClick={() => setTabela('especial')}>Desconto Especial</Button>
            </div>

            <div className="rounded border">
              <div className="flex items-center justify-between border-b px-3 py-2 text-sm">
                <span className="font-medium">Parcelamento</span>
                <span className="flex gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">Até 3x: {fmt(t.totalAte3x)}</Badge>
                  <Badge variant="secondary">4x ou mais: {fmt(t.total4xMais)}</Badge>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 p-3 text-sm sm:grid-cols-3">
                {t.parcelas.map((p) => (
                  <div key={p.parcelas} className="flex justify-between">
                    <span className={p.parcelas === 1 ? 'font-semibold' : ''}>{p.parcelas === 1 ? 'À vista' : `${p.parcelas}x`}</span>
                    <span className={p.valorParcela < 100 && p.parcelas > 1 ? 'text-muted-foreground line-through' : 'font-medium'}>{fmt(p.valorParcela)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(textoProposta(consulta, tabela));
                  toast.success('Proposta copiada');
                }}
              >
                <Copy className="mr-2 h-4 w-4" /> Copiar proposta
              </Button>
              {onEnviar && (
                <Button
                  onClick={() => {
                    onEnviar(textoProposta(consulta, tabela));
                    onOpenChange(false);
                  }}
                >
                  <Send className="mr-2 h-4 w-4" /> Enviar na conversa
                </Button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Parcelas abaixo de R$ 100 aparecem riscadas e não são oferecidas ao cliente.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
