import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { TEMPLATE_PADRAO } from '@/components/modelo-mensagem/ColarImagemTab';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

const VARIAVEIS = [
  '{nome_usuario}', '{nome}', '{primeiro_nome}', '{cpf}', '{contrato}', '{telefone}',
  '{total_atraso}', '{dias_atraso}', '{qtd_parcelas_atraso}', '{valor_parcela_aberto}',
  '{lista_parcelas}',
  '{desconto_vista_pct}', '{valor_quitacao}',
  '{desconto_parcelado_pct}', '{opcoes_parcelado}',
  '{data_hoje}',
];

export function EditarTemplateMensagemDialog({ open, onOpenChange, onSaved }: Props) {
  const { user } = useAuth();
  const [text, setText] = useState(TEMPLATE_PADRAO);
  const [desconto, setDesconto] = useState(50);
  const [descontoParcelado, setDescontoParcelado] = useState(30);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      const { data } = await supabase
        .from('modelo_mensagem_template' as any)
        .select('template, desconto_padrao, desconto_parcelado_padrao')
        .eq('user_id', user.id)
        .maybeSingle();
      const d = data as any;
      setText(d?.template || TEMPLATE_PADRAO);
      if (d?.desconto_padrao != null) setDesconto(Number(d.desconto_padrao));
      if (d?.desconto_parcelado_padrao != null) setDescontoParcelado(Number(d.desconto_parcelado_padrao));
    })();
  }, [open, user]);

  const inserir = (v: string) => setText((t) => t + v);

  const salvar = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('modelo_mensagem_template' as any)
      .upsert({
        user_id: user.id,
        template: text,
        desconto_padrao: desconto,
        desconto_parcelado_padrao: descontoParcelado,
      }, { onConflict: 'user_id' });
    setSaving(false);
    if (error) return toast.error('Erro ao salvar: ' + error.message);
    toast.success('Modelo salvo!');
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Modelo de Mensagem</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Variáveis disponíveis (clique para inserir)</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {VARIAVEIS.map((v) => (
                <Button key={v} type="button" size="sm" variant="outline" onClick={() => inserir(v)}>
                  {v}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="tpl">Mensagem</Label>
            <Textarea id="tpl" value={text} onChange={(e) => setText(e.target.value)} rows={14} className="font-mono text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>% Desconto à vista</Label>
              <Input type="number" min={0} max={100} value={desconto} onChange={(e) => setDesconto(Number(e.target.value))} />
            </div>
            <div>
              <Label>% Desconto parcelado</Label>
              <Input type="number" min={0} max={100} value={descontoParcelado} onChange={(e) => setDescontoParcelado(Number(e.target.value))} />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setText(TEMPLATE_PADRAO)}>Restaurar padrão</Button>
            <Button onClick={salvar} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
