import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { VARIAVEIS_PROPOSTA, TODAS_PARCELAS, detectarCamposLocal, preencherModelo, filtrarTextoPadrao, salvarOpcoes, valoresProposta, type DadosProposta, type OpcoesProposta } from '@/lib/umePropostaModelo';

export function ConfigurarModeloUmeDialog({ open, onOpenChange, dados, modeloAtual, textoPadrao, onSalvo, opcoesAtuais, onOpcoesSalvas }: {
  open: boolean; onOpenChange: (v: boolean) => void; dados: DadosProposta | null;
  modeloAtual: string | null; textoPadrao: string; onSalvo: (texto: string | null) => void;
  opcoesAtuais: OpcoesProposta; onOpcoesSalvas: (o: OpcoesProposta) => void;
}) {
  const [opcoes, setOpcoes] = useState<OpcoesProposta>(opcoesAtuais);
  useEffect(() => { if (open) setOpcoes(opcoesAtuais); }, [open, opcoesAtuais]);
  const alternar = (n: number) => setOpcoes((o) => ({ ...o, parcelas: o.parcelas.includes(n) ? o.parcelas.filter((x) => x !== n) : [...o.parcelas, n].sort((a, b) => a - b) }));
  const salvarSoOpcoes = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    salvarOpcoes(u.user.id, opcoes); onOpcoesSalvas(opcoes);
  };
  const [texto, setTexto] = useState('');
  const [sugerindo, setSugerindo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (open) setTexto(modeloAtual || ''); }, [open, modeloAtual]);

  const sugerir = async () => {
    if (!texto.trim()) return toast.error('Cole o texto que você usa com os clientes');
    if (!dados) return;
    setSugerindo(true);
    try {
      const { data, error } = await supabase.functions.invoke('ume-modelo-sugerir', { body: { texto, valores: valoresProposta(dados) } });
      if (error || !(data as any)?.modelo) throw new Error((data as any)?.error || error?.message);
      setTexto((data as any).modelo);
      toast.success('Campos identificados. Revise o texto antes de salvar.');
    } catch {
      setTexto(detectarCamposLocal(texto, dados));
      toast.info('Campos identificados automaticamente. Revise o texto antes de salvar.');
    } finally { setSugerindo(false); }
  };

  const inserir = (chave: string) => {
    const el = ref.current; const tag = `{${chave}}`;
    if (!el) return setTexto((t) => t + tag);
    const s = el.selectionStart ?? texto.length, e = el.selectionEnd ?? texto.length;
    setTexto(texto.slice(0, s) + tag + texto.slice(e));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + tag.length, s + tag.length); });
  };

  const salvar = async (valor: string | null) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    salvarOpcoes(u.user.id, opcoes); onOpcoesSalvas(opcoes);
    setSalvando(true);
    const r = valor
      ? await supabase.from('ume_proposta_modelos').upsert({ user_id: u.user.id, texto: valor, atualizado_em: new Date().toISOString() })
      : await supabase.from('ume_proposta_modelos').delete().eq('user_id', u.user.id);
    setSalvando(false);
    if (r.error) return toast.error('Não foi possível salvar: ' + r.error.message);
    onSalvo(valor); toast.success(valor ? 'Modelo salvo' : 'Modelo padrão restaurado'); onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar mensagem da proposta</DialogTitle>
          <DialogDescription>Cole o texto que você usa. O sistema troca nome e valores por campos preenchidos automaticamente.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea ref={ref} rows={9} value={texto} onChange={(e) => setTexto(e.target.value)}
            placeholder={'Ex.: Oi Larissa! Seu débito de R$ 10.461,00 sai à vista por R$ 4.713,00...'} />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={sugerir} disabled={sugerindo || !dados}>
              {sugerindo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Identificar partes editáveis
            </Button>
            <Button variant="ghost" onClick={() => setTexto(textoPadrao)}>Usar texto atual como base</Button>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Clique para inserir um campo:</p>
            <div className="flex flex-wrap gap-1">
              {VARIAVEIS_PROPOSTA.map((v) => (
                <Badge key={v.chave} variant="outline" className="cursor-pointer" title={v.descricao} onClick={() => inserir(v.chave)}>{`{${v.chave}}`}</Badge>
              ))}
            </div>
          </div>
          <div className="space-y-2 rounded border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Opções que vão na mensagem</p>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setOpcoes({ avista: true, parcelas: TODAS_PARCELAS })}>Marcar todas</Button>
                <Button size="sm" variant="ghost" onClick={() => setOpcoes({ avista: false, parcelas: [] })}>Desmarcar todas</Button>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={opcoes.avista} onCheckedChange={(v) => setOpcoes((o) => ({ ...o, avista: v }))} /> À vista
            </label>
            <div className="flex flex-wrap gap-1">
              {TODAS_PARCELAS.map((n) => (
                <Button key={n} size="sm" className="h-7 w-11 px-0" variant={opcoes.parcelas.includes(n) ? 'default' : 'outline'} aria-pressed={opcoes.parcelas.includes(n)} onClick={() => alternar(n)}>{n}x</Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Parcelas abaixo de R$ 100 continuam fora mesmo marcadas.</p>
          </div>
          {dados && (
            <div className="rounded border bg-muted/40 p-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Como o cliente vai receber:</p>
              <pre className="whitespace-pre-wrap font-sans text-sm">{texto.trim() ? preencherModelo(texto, dados, opcoes) : filtrarTextoPadrao(textoPadrao, opcoes)}</pre>
            </div>
          )}
          <div className="flex flex-wrap justify-between gap-2 pt-2">
            <Button variant="outline" disabled={salvando || !modeloAtual} onClick={() => salvar(null)}>Restaurar modelo padrão</Button>
            <Button variant="secondary" disabled={salvando} onClick={async () => { await salvarSoOpcoes(); toast.success('Opções salvas'); onOpenChange(false); }}>Salvar só as opções</Button>
            <Button disabled={salvando || !texto.trim()} onClick={() => salvar(texto)}>
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar modelo
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
