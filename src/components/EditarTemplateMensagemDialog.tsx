import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: string;
  descontoPadrao: number;
  descontoParceladoPadrao: number;
  parcelasPadrao: number;
  template2: string;
  descontoPadrao2: number;
  descontoParceladoPadrao2: number;
  parcelasPadrao2: number;
  onSaved1: (template: string, desconto: number, descontoParcelado: number, parcelas: number) => void;
  onSaved2: (template: string, desconto: number, descontoParcelado: number, parcelas: number) => void;
}

const VARIAVEIS = [
  '{nome}', '{cpf}', '{contrato}', '{telefone}',
  '{total_atraso}', '{qtd_parcelas_atraso}', '{valor_parcela_aberto}',
  '{lista_parcelas}',
  '{desconto_vista_pct}', '{valor_quitacao}',
  '{parcelado_qtd}', '{desconto_parcelado_pct}',
  '{valor_cada_parcela_proposta}', '{valor_parcelado_total}',
  '{data_hoje}',
];

export function EditarTemplateMensagemDialog({
  open, onOpenChange,
  template, descontoPadrao, descontoParceladoPadrao, parcelasPadrao,
  template2, descontoPadrao2, descontoParceladoPadrao2, parcelasPadrao2,
  onSaved1, onSaved2,
}: Props) {
  const { user } = useAuth();

  // Mensagem 1
  const [text, setText] = useState(template);
  const [desconto, setDesconto] = useState(descontoPadrao);
  const [descontoParcelado, setDescontoParcelado] = useState(descontoParceladoPadrao);
  const [parcelas, setParcelas] = useState(parcelasPadrao);

  // Mensagem 2
  const [text2, setText2] = useState(template2);
  const [desconto2_, setDesconto2] = useState(descontoPadrao2);
  const [descontoParcelado2, setDescontoParcelado2] = useState(descontoParceladoPadrao2);
  const [parcelas2, setParcelas2] = useState(parcelasPadrao2);

  const [saving1, setSaving1] = useState(false);
  const [saving2, setSaving2] = useState(false);
  const [aba, setAba] = useState<'m1' | 'm2'>('m1');

  useEffect(() => {
    setText(template);
    setDesconto(descontoPadrao);
    setDescontoParcelado(descontoParceladoPadrao);
    setParcelas(parcelasPadrao);
    setText2(template2);
    setDesconto2(descontoPadrao2);
    setDescontoParcelado2(descontoParceladoPadrao2);
    setParcelas2(parcelasPadrao2);
  }, [template, descontoPadrao, descontoParceladoPadrao, parcelasPadrao, template2, descontoPadrao2, descontoParceladoPadrao2, parcelasPadrao2, open]);

  const inserir1 = (v: string) => setText((t) => t + v);
  const inserir2 = (v: string) => setText2((t) => t + v);

  const salvar1 = async () => {
    if (!user) return;
    setSaving1(true);
    const { error } = await supabase
      .from('modelo_mensagem_template' as any)
      .upsert({
        user_id: user.id,
        template: text,
        desconto_padrao: desconto,
        desconto_parcelado_padrao: descontoParcelado,
        parcelas_padrao: parcelas,
      }, { onConflict: 'user_id' });
    setSaving1(false);
    if (error) return toast.error('Erro ao salvar Mensagem 1: ' + error.message);
    toast.success('Mensagem 1 salva!');
    onSaved1(text, desconto, descontoParcelado, parcelas);
  };

  const salvar2 = async () => {
    if (!user) return;
    setSaving2(true);
    const { error } = await supabase
      .from('modelo_mensagem_template' as any)
      .upsert({
        user_id: user.id,
        template_2: text2,
        desconto_padrao_2: desconto2_,
        desconto_parcelado_padrao_2: descontoParcelado2,
        parcelas_padrao_2: parcelas2,
      }, { onConflict: 'user_id' });
    setSaving2(false);
    if (error) return toast.error('Erro ao salvar Mensagem 2: ' + error.message);
    toast.success('Mensagem 2 salva!');
    onSaved2(text2, desconto2_, descontoParcelado2, parcelas2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Editar Modelos de Mensagem</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Variáveis disponíveis (clique para inserir na aba ativa)</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {VARIAVEIS.map((v) => (
                <Button
                  key={v}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => (aba === 'm1' ? inserir1(v) : inserir2(v))}
                >
                  {v}
                </Button>
              ))}
            </div>
          </div>

          <Tabs value={aba} onValueChange={(v) => setAba(v as 'm1' | 'm2')}>
            <TabsList>
              <TabsTrigger value="m1">Mensagem 1</TabsTrigger>
              <TabsTrigger value="m2">Mensagem 2</TabsTrigger>
            </TabsList>

            <TabsContent value="m1" className="space-y-4 mt-3">
              <div>
                <Label htmlFor="tpl1">Mensagem 1</Label>
                <Textarea id="tpl1" value={text} onChange={(e) => setText(e.target.value)} rows={12} className="font-mono text-sm" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>% Desconto à vista</Label>
                  <Input type="number" min={0} max={100} value={desconto} onChange={(e) => setDesconto(Number(e.target.value))} />
                </div>
                <div>
                  <Label>% Desconto parcelado</Label>
                  <Input type="number" min={0} max={100} value={descontoParcelado} onChange={(e) => setDescontoParcelado(Number(e.target.value))} />
                </div>
                <div>
                  <Label>Nº parcelas</Label>
                  <Input type="number" min={1} max={60} value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))} />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={salvar1} disabled={saving1}>
                  {saving1 ? 'Salvando...' : 'Salvar Mensagem 1'}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="m2" className="space-y-4 mt-3">
              <div>
                <Label htmlFor="tpl2">Mensagem 2</Label>
                <Textarea id="tpl2" value={text2} onChange={(e) => setText2(e.target.value)} rows={12} className="font-mono text-sm" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>% Desconto à vista</Label>
                  <Input type="number" min={0} max={100} value={desconto2_} onChange={(e) => setDesconto2(Number(e.target.value))} />
                </div>
                <div>
                  <Label>% Desconto parcelado</Label>
                  <Input type="number" min={0} max={100} value={descontoParcelado2} onChange={(e) => setDescontoParcelado2(Number(e.target.value))} />
                </div>
                <div>
                  <Label>Nº parcelas</Label>
                  <Input type="number" min={1} max={60} value={parcelas2} onChange={(e) => setParcelas2(Number(e.target.value))} />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={salvar2} disabled={saving2}>
                  {saving2 ? 'Salvando...' : 'Salvar Mensagem 2'}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
