import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Plus, Save, Trash2, Percent } from 'lucide-react';
import { toast } from 'sonner';
import { normalizeCredor, type FaixaDescontoCredor } from '@/lib/descontoPortal';

type Linha = {
  dias_de: string;
  dias_ate: string;
  desc_avista: string;
  desc_parcelado: string;
};

const PADRAO: Linha[] = [
  { dias_de: '0', dias_ate: '200', desc_avista: '10', desc_parcelado: '0' },
  { dias_de: '201', dias_ate: '300', desc_avista: '20', desc_parcelado: '10' },
  { dias_de: '301', dias_ate: '500', desc_avista: '30', desc_parcelado: '20' },
  { dias_de: '501', dias_ate: '', desc_avista: '50', desc_parcelado: '30' },
];

function toLinha(f: FaixaDescontoCredor): Linha {
  return {
    dias_de: String(f.dias_de ?? 0),
    dias_ate: f.dias_ate == null ? '' : String(f.dias_ate),
    desc_avista: String(f.desc_avista ?? 0),
    desc_parcelado: String(f.desc_parcelado ?? 0),
  };
}

interface Props {
  credor: string;
  /** Nome exibido no título (opcional) */
  titulo?: string;
}

export default function DescontosCredorEditor({ credor, titulo }: Props) {
  const credorKey = normalizeCredor(credor);
  const [linhas, setLinhas] = useState<Linha[]>(PADRAO);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [temSalvo, setTemSalvo] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('credor_desconto_faixas')
      .select('dias_de,dias_ate,desc_avista,desc_parcelado')
      .eq('credor', credorKey)
      .order('dias_de', { ascending: true });
    if (!error && data && data.length > 0) {
      setLinhas((data as FaixaDescontoCredor[]).map(toLinha));
      setTemSalvo(true);
    } else {
      setLinhas(PADRAO);
      setTemSalvo(false);
    }
    setLoading(false);
  }, [credorKey]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const setCampo = (i: number, campo: keyof Linha, valor: string) => {
    setLinhas((prev) => prev.map((l, idx) => (idx === i ? { ...l, [campo]: valor } : l)));
  };

  const adicionarFaixa = () => {
    setLinhas((prev) => {
      const ultima = prev[prev.length - 1];
      const inicio = ultima && ultima.dias_ate !== '' ? Number(ultima.dias_ate) + 1 : '';
      return [
        ...prev,
        { dias_de: inicio === '' ? '' : String(inicio), dias_ate: '', desc_avista: '0', desc_parcelado: '0' },
      ];
    });
  };

  const removerFaixa = (i: number) => {
    setLinhas((prev) => prev.filter((_, idx) => idx !== i));
  };

  const validar = (): FaixaDescontoCredor[] | null => {
    if (linhas.length === 0) {
      toast.error('Adicione ao menos uma faixa de atraso.');
      return null;
    }
    const out: FaixaDescontoCredor[] = [];
    for (let i = 0; i < linhas.length; i++) {
      const l = linhas[i];
      const de = Number(l.dias_de);
      const ate = l.dias_ate.trim() === '' ? null : Number(l.dias_ate);
      const av = Number(String(l.desc_avista).replace(',', '.'));
      const pa = Number(String(l.desc_parcelado).replace(',', '.'));
      if (!Number.isFinite(de) || de < 0) {
        toast.error(`Faixa ${i + 1}: informe o dia inicial.`);
        return null;
      }
      if (ate !== null && (!Number.isFinite(ate) || ate < de)) {
        toast.error(`Faixa ${i + 1}: o dia final deve ser maior ou igual ao inicial.`);
        return null;
      }
      if (![av, pa].every((v) => Number.isFinite(v) && v >= 0 && v <= 100)) {
        toast.error(`Faixa ${i + 1}: os percentuais devem ficar entre 0 e 100.`);
        return null;
      }
      out.push({ dias_de: de, dias_ate: ate, desc_avista: av, desc_parcelado: pa });
    }
    const ordenadas = [...out].sort((a, b) => a.dias_de - b.dias_de);
    for (let i = 1; i < ordenadas.length; i++) {
      const anterior = ordenadas[i - 1];
      if (anterior.dias_ate == null || ordenadas[i].dias_de <= anterior.dias_ate) {
        toast.error('As faixas não podem se sobrepor. Revise os intervalos de dias.');
        return null;
      }
    }
    return ordenadas;
  };

  const salvar = async () => {
    const faixas = validar();
    if (!faixas) return;
    setSaving(true);
    try {
      const { error: delErr } = await (supabase as any)
        .from('credor_desconto_faixas')
        .delete()
        .eq('credor', credorKey);
      if (delErr) throw delErr;
      const { error: insErr } = await (supabase as any)
        .from('credor_desconto_faixas')
        .insert(faixas.map((f) => ({ ...f, credor: credorKey })));
      if (insErr) throw insErr;
      setTemSalvo(true);
      toast.success('Descontos salvos. O portal já está usando essas faixas.');
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + (e?.message ?? String(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Percent className="h-4 w-4" />
          Descontos do portal — {titulo || credor}
        </CardTitle>
        <CardDescription>
          Defina o desconto à vista e parcelado por faixa de dias de atraso. Deixe o campo “Até” vazio na última
          faixa para valer “sem limite”.
          {!temSalvo && !loading && ' Nenhuma faixa salva ainda — abaixo estão as faixas padrão do sistema como ponto de partida.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando faixas...
          </div>
        ) : (
          <>
            <div className="hidden gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
              <span>De (dias)</span>
              <span>Até (dias)</span>
              <span>% à vista</span>
              <span>% parcelado</span>
              <span />
            </div>
            {linhas.map((l, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto] sm:items-center">
                <div className="space-y-1">
                  <Label className="text-xs sm:hidden">De (dias)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={l.dias_de}
                    onChange={(e) => setCampo(i, 'dias_de', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs sm:hidden">Até (dias)</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="sem limite"
                    value={l.dias_ate}
                    onChange={(e) => setCampo(i, 'dias_ate', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs sm:hidden">% à vista</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={l.desc_avista}
                    onChange={(e) => setCampo(i, 'desc_avista', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs sm:hidden">% parcelado</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={l.desc_parcelado}
                    onChange={(e) => setCampo(i, 'desc_parcelado', e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removerFaixa(i)}
                  aria-label={`Remover faixa ${i + 1}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={adicionarFaixa}>
                <Plus className="mr-1 h-4 w-4" /> Adicionar faixa
              </Button>
              <Button type="button" size="sm" onClick={salvar} disabled={saving}>
                {saving ? (
                  <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Salvando...</>
                ) : (
                  <><Save className="mr-1 h-4 w-4" /> Salvar descontos</>
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
