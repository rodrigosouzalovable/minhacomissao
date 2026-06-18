import { useEffect, useState, useCallback, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Loader2, Upload, Copy, Settings, Sparkles, X } from 'lucide-react';
import { EditarTemplateMensagemDialog } from '@/components/EditarTemplateMensagemDialog';

const TEMPLATE_PADRAO = `Olá, {nome}! Tudo bem?

Identificamos {qtd_parcelas_atraso} parcelas em aberto no contrato {contrato}, totalizando *R$ {total_atraso}*.

📋 *Parcelas em aberto:*
{lista_parcelas}

💰 *Condições especiais para hoje:*

✅ *À VISTA* com {desconto_pct}% de desconto:
   *R$ {valor_quitacao}*

✅ *PARCELADO* em {parcelas_qtd}x de:
   *R$ {valor_parcela}*

Posso confirmar qual opção é melhor para você?`;

interface Parcela { numero: string; vencimento: string; valor: number; atraso: number; }
interface Extracted {
  nome?: string;
  cpf?: string;
  contrato?: string;
  total_atraso?: number;
  neg_data?: string;
  credor_sigla?: string;
  parcelas?: Parcela[];
}

const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtData = () => new Date().toLocaleDateString('pt-BR');

function renderMensagem(tpl: string, d: Extracted, desconto: number, parcelas: number): string {
  const total = d.total_atraso || 0;
  const valorQuit = total * (1 - desconto / 100);
  const valorParc = parcelas > 0 ? total / parcelas : 0;
  const lista = (d.parcelas || [])
    .map((p) => `• Parcela ${p.numero} — venc. ${p.vencimento} — R$ ${fmtBRL(p.valor)} (${p.atraso} dias de atraso)`)
    .join('\n');
  const map: Record<string, string> = {
    '{nome}': d.nome || '',
    '{cpf}': d.cpf || '',
    '{contrato}': d.contrato || '',
    '{total_atraso}': fmtBRL(total),
    '{qtd_parcelas_atraso}': String((d.parcelas || []).length),
    '{desconto_pct}': String(desconto),
    '{valor_quitacao}': fmtBRL(valorQuit),
    '{parcelas_qtd}': String(parcelas),
    '{valor_parcela}': fmtBRL(valorParc),
    '{lista_parcelas}': lista,
    '{data_hoje}': fmtData(),
  };
  return tpl.replace(/\{[a-z_]+\}/g, (m) => map[m] ?? m);
}

export default function ModeloMensagem() {
  const { user } = useAuth();
  const [template, setTemplate] = useState(TEMPLATE_PADRAO);
  const [desconto, setDesconto] = useState(50);
  const [parcelas, setParcelas] = useState(12);
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // Load saved template
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
        if (d.desconto_padrao != null) setDesconto(Number(d.desconto_padrao));
        if (d.parcelas_padrao != null) setParcelas(Number(d.parcelas_padrao));
      }
    })();
  }, [user]);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Apenas imagens são aceitas');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  // Paste handler
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of items) {
        if (it.type.startsWith('image/')) {
          const f = it.getAsFile();
          if (f) { handleFile(f); break; }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [handleFile]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const extrair = async () => {
    if (!image) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-cobmais-print', { body: { image } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setExtracted(data.data as Extracted);
      toast.success('Dados extraídos!');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao extrair dados');
    } finally {
      setLoading(false);
    }
  };

  const mensagem = extracted ? renderMensagem(template, extracted, desconto, parcelas) : '';

  const copiar = async () => {
    await navigator.clipboard.writeText(mensagem);
    toast.success('Mensagem copiada!');
  };

  const updateField = (k: keyof Extracted, v: any) => setExtracted((e) => ({ ...(e || {}), [k]: v }));
  const updateParcela = (i: number, k: keyof Parcela, v: any) => {
    setExtracted((e) => {
      if (!e?.parcelas) return e;
      const arr = [...e.parcelas];
      arr[i] = { ...arr[i], [k]: k === 'valor' || k === 'atraso' ? Number(v) : v };
      return { ...e, parcelas: arr };
    });
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold">Modelo Mensagem</h1>
            <p className="text-sm text-muted-foreground">Cole um print do Cob+ e gere a mensagem de negociação automaticamente.</p>
          </div>
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Settings className="h-4 w-4 mr-2" /> Editar Modelo
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Coluna 1: print */}
          <Card>
            <CardHeader><CardTitle className="text-base">1. Cole o print</CardTitle></CardHeader>
            <CardContent>
              <div
                ref={dropRef}
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50 transition"
                onClick={() => document.getElementById('file-input')?.click()}
              >
                {image ? (
                  <div className="relative">
                    <img src={image} alt="Print" className="max-h-64 mx-auto rounded" />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute top-1 right-1 h-6 w-6"
                      onClick={(e) => { e.stopPropagation(); setImage(null); setExtracted(null); }}
                    ><X className="h-3 w-3" /></Button>
                  </div>
                ) : (
                  <div className="py-8 text-muted-foreground">
                    <Upload className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm">Clique, arraste ou pressione <kbd className="px-1 border rounded">Ctrl+V</kbd></p>
                  </div>
                )}
                <input
                  id="file-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </div>
              <Button className="w-full mt-3" onClick={extrair} disabled={!image || loading}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Extrair Dados
              </Button>
              <p className="text-[10px] text-muted-foreground mt-2 text-center">⚡ Consome créditos de IA Lovable Gateway</p>
            </CardContent>
          </Card>

          {/* Coluna 2: dados + parâmetros */}
          <Card>
            <CardHeader><CardTitle className="text-base">2. Dados & Condições</CardTitle></CardHeader>
            <CardContent className="space-y-3 max-h-[600px] overflow-y-auto">
              {extracted ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">Nome</Label><Input value={extracted.nome || ''} onChange={(e) => updateField('nome', e.target.value)} /></div>
                    <div><Label className="text-xs">CPF</Label><Input value={extracted.cpf || ''} onChange={(e) => updateField('cpf', e.target.value)} /></div>
                    <div><Label className="text-xs">Contrato</Label><Input value={extracted.contrato || ''} onChange={(e) => updateField('contrato', e.target.value)} /></div>
                    <div><Label className="text-xs">Total atraso (R$)</Label><Input type="number" value={extracted.total_atraso ?? 0} onChange={(e) => updateField('total_atraso', Number(e.target.value))} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                    <div><Label className="text-xs">% Desconto à vista</Label><Input type="number" value={desconto} onChange={(e) => setDesconto(Number(e.target.value))} /></div>
                    <div><Label className="text-xs">Nº parcelas</Label><Input type="number" value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))} /></div>
                  </div>
                  {extracted.parcelas && extracted.parcelas.length > 0 && (
                    <div className="pt-2 border-t">
                      <Label className="text-xs">Parcelas ({extracted.parcelas.length})</Label>
                      <div className="space-y-1 mt-1">
                        {extracted.parcelas.map((p, i) => (
                          <div key={i} className="grid grid-cols-4 gap-1 text-xs">
                            <Input className="h-7 text-xs" value={p.numero} onChange={(e) => updateParcela(i, 'numero', e.target.value)} />
                            <Input className="h-7 text-xs" value={p.vencimento} onChange={(e) => updateParcela(i, 'vencimento', e.target.value)} />
                            <Input className="h-7 text-xs" type="number" value={p.valor} onChange={(e) => updateParcela(i, 'valor', e.target.value)} />
                            <Input className="h-7 text-xs" type="number" value={p.atraso} onChange={(e) => updateParcela(i, 'atraso', e.target.value)} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Cole um print e clique em "Extrair Dados"</p>
              )}
            </CardContent>
          </Card>

          {/* Coluna 3: mensagem */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">3. Mensagem Final</CardTitle>
              {mensagem && (
                <Button size="sm" onClick={copiar}><Copy className="h-4 w-4 mr-2" />Copiar</Button>
              )}
            </CardHeader>
            <CardContent>
              <Textarea
                value={mensagem}
                readOnly
                rows={24}
                className="font-mono text-xs bg-muted/30"
                placeholder="A mensagem aparecerá aqui depois da extração..."
              />
            </CardContent>
          </Card>
        </div>

        <EditarTemplateMensagemDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          template={template}
          descontoPadrao={desconto}
          parcelasPadrao={parcelas}
          onSaved={(t, d, p) => { setTemplate(t); setDesconto(d); setParcelas(p); }}
        />
      </div>
    </AppLayout>
  );
}
