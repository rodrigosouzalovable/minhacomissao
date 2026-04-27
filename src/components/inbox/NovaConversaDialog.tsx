import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Instancia {
  id: string;
  nome: string | null;
  server_url: string;
  instance_token: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instancias: Instancia[];
  onConversaCriada: (telefoneCompleto: string, instanciaId: string) => void;
}

export function NovaConversaDialog({ open, onOpenChange, instancias, onConversaCriada }: Props) {
  const { toast } = useToast();
  const [telefone, setTelefone] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [instanciaId, setInstanciaId] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [comboOpen, setComboOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setTelefone('');
      setMensagem('');
      setInstanciaId('');
      setComboOpen(false);
    }
  }, [open]);

  const handleEnviar = async () => {
    if (!telefone || !instanciaId || !mensagem.trim()) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    const instancia = instancias.find(i => i.id === instanciaId);
    if (!instancia) return;

    const telefoneFormatado = telefone.replace(/\D/g, '');
    const telefoneCompleto = telefoneFormatado.startsWith('55') ? telefoneFormatado : `55${telefoneFormatado}`;

    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          telefone: telefoneCompleto,
          mensagem: mensagem.trim(),
          uazapi_server_url: instancia.server_url,
          uazapi_instance_token: instancia.instance_token,
          instancia_id: instancia.id,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Falha ao enviar');

      toast({ title: 'Mensagem enviada', description: 'Conversa iniciada com sucesso' });
      onOpenChange(false);
      onConversaCriada(telefoneCompleto, instancia.id);
    } catch (err: any) {
      toast({ title: 'Erro ao enviar', description: err.message, variant: 'destructive' });
    } finally {
      setEnviando(false);
    }
  };

  const instanciaSelecionada = instancias.find(i => i.id === instanciaId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova conversa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input
              placeholder="5511999999999"
              value={telefone}
              onChange={e => setTelefone(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Inclua o código do país (55 para Brasil)</p>
          </div>
          <div className="space-y-2">
            <Label>Instância</Label>
            <Popover open={comboOpen} onOpenChange={setComboOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={comboOpen} className="w-full justify-between font-normal">
                  {instanciaSelecionada ? (instanciaSelecionada.nome || 'Instância') : 'Selecione uma instância'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar instância..." />
                  <CommandList>
                    <CommandEmpty>Nenhuma instância encontrada.</CommandEmpty>
                    <CommandGroup>
                      {instancias.map(inst => (
                        <CommandItem
                          key={inst.id}
                          value={inst.nome || inst.id}
                          onSelect={() => {
                            setInstanciaId(inst.id);
                            setComboOpen(false);
                          }}
                        >
                          <Check className={cn('mr-2 h-4 w-4', instanciaId === inst.id ? 'opacity-100' : 'opacity-0')} />
                          {inst.nome || 'Instância'}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label>Mensagem</Label>
            <Textarea
              placeholder="Digite a primeira mensagem..."
              value={mensagem}
              onChange={e => setMensagem(e.target.value)}
              rows={3}
            />
          </div>
          <Button
            onClick={handleEnviar}
            disabled={enviando || !telefone || !instanciaId || !mensagem.trim()}
            className="w-full"
          >
            {enviando ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Enviando...</> : 'Iniciar conversa'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
