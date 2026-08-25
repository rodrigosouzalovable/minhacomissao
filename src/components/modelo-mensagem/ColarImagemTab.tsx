import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Upload, Copy, Trash2, Sparkles, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { renderMensagem, type ClienteImportado } from '@/lib/parseCobmaisPlanilha';

export const TEMPLATE_PADRAO = `Meu nome é {nome_usuario} falo referente à loja Novo Mundo.

Identificamos algumas parcelas em atraso que totalizam *R$ {total_atraso}*.

💰 E hoje temos uma condições especiais para você:

✅ *À VISTA* com {desconto_vista_pct}% de desconto:

   R$ {valor_quitacao}

{opcoes_parcelado}

*Qual opção é melhor para você? Que dia consegue realizar o pagamento?*`;

interface Props {
  /** Compacta o layout (usado no diálogo do Inbox). */
  compact?: boolean;
}

interface CamposExtraidos {
  nome: string;
  cpf: string;
  contrato: string;
  dias_atraso: string;
  qtd_parcelas_atraso: string;
  total_atraso: string;
}

const EMPTY: CamposExtraidos = {
  nome: '', cpf: '', contrato: '', dias_atraso: '', qtd_parcelas_atraso: '1', total_atraso: '',
};

export function ColarImagemTab({ compact }: Props) {
  const { user } = useAuth();

  const [template, setTemplate] = useState(TEMPLATE_PADRAO);
  const [descVista, setDescVista] = useState(50);
  const [descParcelado, setDescParcelado] = useState(30);
  const [nomeUsuario, setNomeUsuario] = useState('');
  const [hydrated, setHydrated] = useState(false);

  const [imageData, setImageData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [campos, setCampos] = useState<CamposExtraidos>(EMPTY);
  const dropRef = useRef<HTMLDivElement>(null);

  // Carrega template + descontos salvos e o nome do usuário
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [{ data: tpl }, { data: prof }] = await Promise.all([
        supabase
          .from('modelo_mensagem_template' as any)
          .select('template, desconto_padrao, desconto_parcelado_padrao')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase.from('profiles').select('nome').eq('id', user.id).maybeSingle(),
      ]);
      if (cancelled) return;
      const d = tpl as any;
      if (d?.template) setTemplate(d.template);
      if (d?.desconto_padrao != null) setDescVista(Number(d.desconto_padrao));
      if (d?.desconto_parcelado_padrao != null) setDescParcelado(Number(d.desconto_parcelado_padrao));
      setNomeUsuario(String((prof as any)?.nome || ''));
      setHydrated(true);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Salva os descontos (debounce)
  useEffect(() => {
    if (!user || !hydrated) return;
    const t = setTimeout(() => {
      supabase
        .from('modelo_mensagem_template' as any)
        .upsert({
          user_id: user.id,
          template,
          desconto_padrao: descVista,
          desconto_parcelado_padrao: descParcelado,
        }, { onConflict: 'user_id' })
        .then(({ error }) => { if (error) console.error('[modelo_mensagem_template] upsert', error); });
    }, 700);
    return () => clearTimeout(t);
  }, [descVista, descParcelado, template, user, hydrated]);

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

  const loadFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImageData(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  };

  const extrair = async () => {
    if (!imageData) {
      toast.error('Cole ou anexe uma imagem primeiro');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-modelo-mensagem', {
        body: { image: imageData },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Falha na extração');
      const d = data.data;
      setCampos({
        nome: d.nome ?? '',
        cpf: d.cpf ?? '',
        contrato: d.contrato ?? '',
        dias_atraso: d.dias_atraso != null ? String(d.dias_atraso) : '',
        qtd_parcelas_atraso: d.qtd_parcelas_atraso != null ? String(d.qtd_parcelas_atraso) : '1',
        total_atraso: d.total_atraso != null ? String(d.total_atraso) : '',
      });
      toast.success('Dados extraídos!');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao extrair dados');
    } finally {
      setLoading(false);
    }
  };

  const limpar = () => {
    setImageData(null);
    setCampos(EMPTY);
  };

  const mensagem = useMemo(() => {
    const cliente: ClienteImportado = {
      cpf: campos.cpf,
      nome: campos.nome,
      contrato: campos.contrato,
      telefone: '',
      telefones: [],
      totalAtraso: Number(String(campos.total_atraso).replace(',', '.')) || 0,
      diasAtraso: Number(campos.dias_atraso) || 0,
      parcelas: Array.from({ length: Math.max(1, Number(campos.qtd_parcelas_atraso) || 1) }, (_, i) => ({
        numero: String(i + 1).padStart(2, '0'),
        vencimento: '',
        valor: 0,
      })),
    };
    return renderMensagem(template, {
      cliente,
      descontoVistaPct: descVista,
      parceladoQtd: 0,
      descontoParceladoPct: descParcelado,
      nomeUsuario,
    });
  }, [campos, template, descVista, descParcelado, nomeUsuario]);

  const copiar = async (txt: string, label: string) => {
    await navigator.clipboard.writeText(txt);
    toast.success(`${label} copiado!`);
  };

  const podeGerar = !!campos.nome && !!campos.total_atraso;

  return (
    <div className={`grid grid-cols-1 ${compact ? '' : 'lg:grid-cols-2'} gap-4`}>
      {/* Coluna esquerda — imagem */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">1. Cole o print da tela do Cob+</Label>
            {imageData && (
              <Button variant="ghost" size="sm" onClick={limpar}>
                <Trash2 className="h-4 w-4 mr-1" /> Limpar
              </Button>
            )}
          </div>

          <div
            ref={dropRef}
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            className={`border-2 border-dashed rounded-lg p-4 ${compact ? 'min-h-[160px]' : 'min-h-[260px]'} flex flex-col items-center justify-center bg-muted/30`}
          >
            {imageData ? (
              <img src={imageData} alt="Preview" className={`${compact ? 'max-h-[220px]' : 'max-h-[400px]'} max-w-full rounded`} />
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
              id="img-modelo-input"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])}
            />
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => document.getElementById('img-modelo-input')?.click()}
            >
              <Upload className="h-4 w-4 mr-2" /> Selecionar arquivo
            </Button>
            <Button className="flex-1" disabled={!imageData || loading} onClick={extrair}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Extrair dados
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Coluna direita — campos + descontos + mensagem */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-medium">2. Confira / ajuste os dados</Label>

          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <Label className="text-xs">Nome</Label>
              <Input value={campos.nome} onChange={(e) => setCampos({ ...campos, nome: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">CPF</Label>
              <Input value={campos.cpf} onChange={(e) => setCampos({ ...campos, cpf: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Contrato</Label>
              <Input value={campos.contrato} onChange={(e) => setCampos({ ...campos, contrato: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Dias de atraso</Label>
              <Input type="number" value={campos.dias_atraso}
                onChange={(e) => setCampos({ ...campos, dias_atraso: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Qtd. parcelas em atraso</Label>
              <Input type="number" min={1} value={campos.qtd_parcelas_atraso}
                onChange={(e) => setCampos({ ...campos, qtd_parcelas_atraso: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Total em atraso (R$)</Label>
              <Input type="number" step="0.01" value={campos.total_atraso}
                onChange={(e) => setCampos({ ...campos, total_atraso: e.target.value })} />
            </div>
          </div>

          <div className="pt-2 border-t space-y-2">
            <Label className="text-sm font-medium">Descontos</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">% à vista</Label>
                <Input type="number" min={0} max={100} value={descVista}
                  onChange={(e) => setDescVista(Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">% parcelado</Label>
                <Input type="number" min={0} max={100} value={descParcelado}
                  onChange={(e) => setDescParcelado(Number(e.target.value))} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Os descontos ficam salvos para os próximos atendimentos. Parcelamento exibe 2x, 4x, 8x, 12x, 16x, 20x e 24x —
              opções com parcela menor que R$ 100 são ocultadas; se nenhuma couber, só o valor à vista é enviado.
            </p>
          </div>

          <div className="pt-2 border-t space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm font-medium">Modelo da mensagem</Label>
              <Button size="sm" variant="ghost" onClick={() => setTemplate(TEMPLATE_PADRAO)}>
                Restaurar modelo padrão
              </Button>
            </div>
            <Textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="min-h-[120px] font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Variáveis: {'{nome_usuario}'}, {'{nome_cliente}'}, {'{primeiro_nome}'}, {'{total_atraso}'},{' '}
              {'{desconto_vista_pct}'}, {'{valor_quitacao}'}, {'{opcoes_parcelado}'}
            </p>
          </div>


          <div className="pt-2 border-t space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Label className="text-sm font-medium">Mensagem gerada</Label>
              <div className="flex gap-1">
                {campos.nome && (
                  <Button size="sm" variant="ghost" onClick={() => copiar(campos.nome, 'Nome')}>
                    <Copy className="h-3.5 w-3.5 mr-1" /> Nome
                  </Button>
                )}
                {campos.cpf && (
                  <Button size="sm" variant="ghost" onClick={() => copiar(campos.cpf, 'CPF')}>
                    <Copy className="h-3.5 w-3.5 mr-1" /> CPF
                  </Button>
                )}
              </div>
            </div>
            <Textarea
              value={podeGerar ? mensagem : ''}
              readOnly
              className={`${compact ? 'min-h-[160px]' : 'min-h-[200px]'} font-mono text-xs`}
              placeholder="Preencha os campos para gerar a mensagem..."
            />
            <Button
              className="w-full"
              disabled={!podeGerar}
              onClick={() => copiar(mensagem, 'Mensagem')}
            >
              <Copy className="h-4 w-4 mr-2" /> Copiar mensagem
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
