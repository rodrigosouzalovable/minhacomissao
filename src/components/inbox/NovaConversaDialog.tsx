import { useState, memo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Instancia {
  id: string;
  nome: string | null;
  server_url: string;
  instance_token: string;
}

interface NovaConversaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instancias: Instancia[];
  enviando: boolean;
  onSubmit: (payload: { telefone: string; instanciaId: string; mensagem: string }) => Promise<void> | void;
}

function NovaConversaDialogImpl({ open, onOpenChange, instancias, enviando, onSubmit }: NovaConversaDialogProps) {
  const [telefone, setTelefone] = useState('');
  const [instanciaId, setInstanciaId] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [comboOpen, setComboOpen] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setTelefone('');
      setInstanciaId('');
      setMensagem('');
      setComboOpen(false);
    }
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    await onSubmit({ telefone, instanciaId, mensagem: mensagem.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
                  {instanciaId
                    ? (instancias.find(i => i.id === instanciaId)?.nome || 'Instância')
                    : 'Selecione uma instância'}
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
                          <Check className={cn("mr-2 h-4 w-4", instanciaId === inst.id ? "opacity-100" : "opacity-0")} />
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
            onClick={handleSubmit}
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

export const NovaConversaDialog = memo(NovaConversaDialogImpl);
