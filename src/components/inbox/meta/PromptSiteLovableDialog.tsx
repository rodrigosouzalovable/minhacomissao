import { useEffect, useMemo, useState } from 'react';
import { Wand2, Copy, Check, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { gerarPromptSite, type DadosSite } from '@/lib/promptSiteLovable';

export function PromptSiteLovableButton({ telefone, nomeContato }: { telefone: string; nomeContato?: string }) {
  const [open, setOpen] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [dados, setDados] = useState<DadosSite>({ nome: nomeContato || '', telefone, idioma: 'en' });
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    const suf = String(telefone || '').replace(/\D/g, '').slice(-10);
    setDados({ nome: nomeContato || '', telefone, idioma: 'en' });
    if (suf.length < 8) return;
    (supabase as any).from('usa_b2b_leads').select('nome,cidade,nicho').like('telefone', `%${suf}`).limit(1)
      .then(({ data }: any) => {
        const l = data?.[0];
        if (l) setDados((p) => ({ ...p, nome: l.nome || p.nome, cidade: l.cidade || '', nicho: l.nicho || '' }));
      });
  }, [open, telefone, nomeContato]);

  const prompt = useMemo(() => gerarPromptSite(dados), [dados]);
  const set = (k: keyof DadosSite) => (e: any) => setDados((p) => ({ ...p, [k]: e.target.value }));
  const copiar = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopiado(true); setTimeout(() => setCopiado(false), 2000);
    toast({ title: 'Prompt copiado', description: 'Cole na Lovable para criar o site.' });
  };

  return (
    <>
      <Button variant="outline" size="icon" className="h-7 w-7 p-0" onClick={() => setOpen(true)}
        title="Gerar prompt do site (Lovable)" aria-label="Gerar prompt do site (Lovable)">
        <Wand2 className="h-3.5 w-3.5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Prompt do site para a Lovable</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Empresa</Label><Input value={dados.nome} onChange={set('nome')} /></div>
            <div><Label>Ramo</Label><Input value={dados.nicho || ''} onChange={set('nicho')} placeholder="painting contractor" /></div>
            <div><Label>Cidade / região</Label><Input value={dados.cidade || ''} onChange={set('cidade')} /></div>
            <div><Label>Idioma do site</Label>
              <Select value={dados.idioma} onValueChange={(v) => setDados((p) => ({ ...p, idioma: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">Inglês</SelectItem>
                  <SelectItem value="bilingue">Bilíngue (EN/PT)</SelectItem>
                  <SelectItem value="pt">Português</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2"><Label>Serviços (opcional, um por linha)</Label><Textarea rows={2} value={dados.servicos || ''} onChange={set('servicos')} /></div>
            <div className="sm:col-span-2"><Label>Diferenciais / observações do cliente (opcional)</Label><Textarea rows={2} value={dados.observacoes || ''} onChange={set('observacoes')} /></div>
          </div>
          <Textarea readOnly value={prompt} rows={12} className="font-mono text-xs" />
          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="outline" asChild><a href="https://lovable.dev" target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 mr-1" />Abrir Lovable</a></Button>
            <Button onClick={copiar}>{copiado ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}Copiar prompt</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
