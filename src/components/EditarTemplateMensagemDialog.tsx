import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
  onSaved: (template: string, desconto: number, descontoParcelado: number, parcelas: number) => void;
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

export function EditarTemplateMensagemDialog({ open, onOpenChange, template, descontoPadrao, descontoParceladoPadrao, parcelasPadrao, onSaved }: Props) {
  const { user } = useAuth();
  const [text, setText] = useState(template);
  const [desconto, setDesconto] = useState(descontoPadrao);
  const [descontoParcelado, setDescontoParcelado] = useState(descontoParceladoPadrao);
  const [parcelas, setParcelas] = useState(parcelasPadrao);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setText(template);
    setDesconto(descontoPadrao);
    setDescontoParcelado(descontoParceladoPadrao);
    setParcelas(parcelasPadrao);
  }, [template, descontoPadrao, descontoParceladoPadrao, parcelasPadrao, open]);

  const inserirVar = (v: string) => setText((t) => t + v);

  const salvar = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('modelo_mensagem_template' as any)
      .upsert({ user_id: user.id, template: text, desconto_padrao: desconto, parcelas_padrao: parcelas }, { onConflict: 'user_id' });
    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
      return;
    }
    toast.success('Modelo salvo!');
    onSaved(text, desconto, parcelas);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Editar Modelo de Mensagem</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Variáveis disponíveis (clique para inserir)</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {VARIAVEIS.map((v) => (
                <Button key={v} type="button" size="sm" variant="outline" onClick={() => inserirVar(v)}>
                  {v}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="tpl">Mensagem (use as variáveis acima)</Label>
            <Textarea id="tpl" value={text} onChange={(e) => setText(e.target.value)} rows={14} className="font-mono text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="desc">% Desconto padrão (à vista)</Label>
              <Input id="desc" type="number" min={0} max={100} value={desconto} onChange={(e) => setDesconto(Number(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="parc">Nº parcelas padrão</Label>
              <Input id="parc" type="number" min={1} max={60} value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
