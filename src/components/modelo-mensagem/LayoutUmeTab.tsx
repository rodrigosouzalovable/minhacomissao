import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Upload, Copy, Trash2, Sparkles, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const TEMPLATE_UME_PADRAO = `Meu nome é {nome_usuario}, falo referente à UME.

Identificamos seu débito e hoje temos condições especiais para você:

✅ *À VISTA:* R$ {valor_avista}

📄 *PARCELADO:*
{opcoes_parcelado}

*Qual opção é melhor para você? Que dia consegue realizar o pagamento?*`;

const GRADE_UME = [2, 4, 6, 8, 12, 18];
const PARCELA_MINIMA = 100;

interface ParcelaLida {
  n: number;
  valor: number;
}

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Props {
  /** Compacta o layout (usado no diálogo do Inbox). */
  compact?: boolean;
}

export function LayoutUmeTab({ compact }: Props) {
  const { user } = useAuth();

  const [template, setTemplate] = useState(TEMPLATE_UME_PADRAO);
  const [nomeUsuario, setNomeUsuario] = useState('');
  const [hydrated, setHydrated] = useState(false);

  const [imageData, setImageData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [nomeCliente, setNomeCliente] = useState('');
  const [valorAvista, setValorAvista] = useState('');
  const [totalAte3x, setTotalAte3x] = useState('');
  const [total4xMais, setTotal4xMais] = useState('');
  const [parcelas, setParcelas] = useState<ParcelaLida[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [{ data: tpl }, { data: prof }] = await Promise.all([
        supabase
          .from('modelo_mensagem_template' as any)
          .select('template_ume')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase.from('profiles').select('nome').eq('id', user.id).maybeSingle(),
      ]);
      if (cancelled) return;
      const t = (tpl as any)?.template_ume;
      if (t) setTemplate(t);
      setNomeUsuario(String((prof as any)?.nome || ''));
      setHydrated(true);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Salva o template (debounce)
  useEffect(() => {
    if (!user || !hydrated) return;
    const t = setTimeout(() => {
      supabase
        .from('modelo_mensagem_template' as any)
        .upsert({ user_id: user.id, template_ume: template }, { onConflict: 'user_id' })
        .then(({ error }) => { if (error) console.error('[modelo_mensagem_template] upsert ume', error); });
    }, 700);
    return () => clearTimeout(t);
  }, [template, user, hydrated]);

  const loadFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImageData(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Listener global de paste
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            loadFile(file);
            e.preventDefault();
            return;
          }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  const extrair = async () => {
    if (!imageData) {
      toast.error('Cole ou anexe a imagem da tabela primeiro');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-modelo-ume', {
        body: { image: imageData },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Falha na extração');
      const d = data.data as {
        valor_avista?: number | null;
        total_ate_3x?: number | null;
        total_4x_ou_mais?: number | null;
        parcelas?: ParcelaLida[];
      };
      const lidas = (d.parcelas || [])
        .filter((p) => Number(p?.n) > 0 && Number(p?.valor) > 0)
        .map((p) => ({ n: Number(p.n), valor: Number(p.valor) }))
        .sort((a, b) => a.n - b.n);
      setParcelas(lidas);
      const avista = d.valor_avista ?? lidas.find((p) => p.n === 1)?.valor ?? null;
      const fmtBR = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      setValorAvista(avista != null ? fmtBR(Number(avista)) : '');
      setTotalAte3x(d.total_ate_3x != null ? fmtBR(Number(d.total_ate_3x)) : '');
      setTotal4xMais(d.total_4x_ou_mais != null ? fmtBR(Number(d.total_4x_ou_mais)) : '');
      toast.success('Tabela extraída!');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao extrair dados');
    } finally {
      setLoading(false);
    }
  };

  const limpar = () => {
    setImageData(null);
    setParcelas([]);
    setValorAvista('');
    setTotalAte3x('');
    setTotal4xMais('');
  };

  const num = (v: string) => Number(String(v).replace(/\./g, '').replace(',', '.')) || 0;

  const opcoes = useMemo(() => {
    const base3 = num(totalAte3x);
    const base4 = num(total4xMais);
    const out: { n: number; valor: number }[] = [];
    for (const n of GRADE_UME) {
      const lida = parcelas.find((p) => p.n === n);
      let valor = lida?.valor ?? 0;
      if (!valor) {
        const base = n <= 3 ? base3 : base4;
        if (!base) continue;
        valor = base / n;
      }
      if (valor >= PARCELA_MINIMA) out.push({ n, valor });
    }
    return out;
  }, [parcelas, totalAte3x, total4xMais]);

  const mensagem = useMemo(() => {
    const primeiroNome = nomeCliente.trim().split(/\s+/)[0] || '';
    const lista = opcoes.map((o) => `• ${o.n}x de R$ ${brl(o.valor)}`).join('\n');
    return template
      .replace(/\{nome_usuario\}/g, nomeUsuario)
      .replace(/\{nome_cliente\}/g, nomeCliente.trim())
      .replace(/\{primeiro_nome\}/g, primeiroNome)
      .replace(/\{valor_avista\}/g, valorAvista ? brl(num(valorAvista)) : '')
      .replace(/\{opcoes_parcelado\}/g, lista)
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }, [template, nomeUsuario, nomeCliente, valorAvista, opcoes]);

  const podeGerar = !!valorAvista && opcoes.length > 0;

  const copiar = async (txt: string, label: string) => {
    await navigator.clipboard.writeText(txt);
    toast.success(`${label} copiado!`);
  };

  return (
    <div className={`grid grid-cols-1 ${compact ? '' : 'lg:grid-cols-2'} gap-4`}>
      {/* Coluna esquerda — imagem */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">1. Cole a "Tabela - Desconto Especial" da UME</Label>
            {imageData && (
              <Button variant="ghost" size="sm" onClick={limpar}>
                <Trash2 className="h-4 w-4 mr-1" /> Limpar
              </Button>
            )}
          </div>

          <div
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) loadFile(f); }}
            onDragOver={(e) => e.preventDefault()}
            className={`border-2 border-dashed rounded-lg p-4 ${compact ? 'min-h-[160px]' : 'min-h-[260px]'} flex flex-col items-center justify-center bg-muted/30`}
          >
            {imageData ? (
              <img src={imageData} alt="Tabela UME" className={`${compact ? 'max-h-[220px]' : 'max-h-[400px]'} max-w-full rounded`} />
            ) : (
              <div className="text-center text-sm text-muted-foreground space-y-2">
                <ImageIcon className="h-10 w-10 mx-auto opacity-50" />
                <p>Cole (<kbd className="px-1 py-0.5 rounded border text-xs">Ctrl+V</kbd>) ou arraste a imagem aqui</p>
                <p className="text-xs">Cada extração consome créditos de IA.</p>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <input
              id="img-ume-input"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])}
            />
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => document.getElementById('img-ume-input')?.click()}
            >
              <Upload className="h-4 w-4 mr-2" /> Selecionar arquivo
            </Button>
            <Button className="flex-1" disabled={!imageData || loading} onClick={extrair}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Extrair dados
            </Button>
          </div>

          {parcelas.length > 0 && (
            <div className="text-xs text-muted-foreground">
              Linhas lidas da tabela: {parcelas.map((p) => `${p.n}x`).join(', ')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Coluna direita — campos + mensagem */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-medium">2. Confira / ajuste os dados</Label>

          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <Label className="text-xs">Nome do cliente (opcional)</Label>
              <Input value={nomeCliente} onChange={(e) => setNomeCliente(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Valor à vista (1x)</Label>
              <Input type="number" step="0.01" value={valorAvista}
                onChange={(e) => setValorAvista(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Total até 3x</Label>
              <Input type="number" step="0.01" value={totalAte3x}
                onChange={(e) => setTotalAte3x(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Total 4x ou mais</Label>
              <Input type="number" step="0.01" value={total4xMais}
                onChange={(e) => setTotal4xMais(e.target.value)} />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Opções exibidas: 2x, 4x, 6x, 8x, 12x e 18x. Quando a quantidade não estiver na tabela da imagem,
            o valor é calculado pelo total (até 3x para 2x/3x, e "4x ou mais" para 4x em diante).
            Parcelas abaixo de R$ 100 são omitidas.
          </p>

          {opcoes.length > 0 && (
            <div className="rounded-md border divide-y text-sm">
              {opcoes.map((o) => (
                <div key={o.n} className="flex justify-between px-3 py-1.5">
                  <span className="font-medium">{o.n}x</span>
                  <span>R$ {brl(o.valor)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 border-t space-y-2">
            <Label className="text-sm font-medium">Modelo da mensagem</Label>
            <Textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="min-h-[120px] font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Variáveis: {'{nome_usuario}'}, {'{nome_cliente}'}, {'{primeiro_nome}'}, {'{valor_avista}'}, {'{opcoes_parcelado}'}
            </p>
          </div>

          <div className="pt-2 border-t space-y-2">
            <Label className="text-sm font-medium">Mensagem gerada</Label>
            <Textarea
              value={podeGerar ? mensagem : ''}
              readOnly
              className={`${compact ? 'min-h-[160px]' : 'min-h-[200px]'} font-mono text-xs`}
              placeholder="Cole a imagem e extraia os dados para gerar a mensagem..."
            />
            <Button className="w-full" disabled={!podeGerar} onClick={() => copiar(mensagem, 'Mensagem')}>
              <Copy className="h-4 w-4 mr-2" /> Copiar mensagem
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
