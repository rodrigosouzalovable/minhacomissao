import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ListChecks } from 'lucide-react';

export default function TemplateApprovedInstances({ instances, selectedIds }: {
  instances: Array<{ id: string; nome: string; telefone?: string | null }>;
  selectedIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = instances.filter(i => `${i.nome} ${i.telefone || ''}`.toLowerCase().includes(search.toLowerCase()));
  return <>
    <Button size="sm" variant="outline" onClick={() => { setSearch(''); setOpen(true); }}><ListChecks className="h-4 w-4 mr-2" />Ver instâncias aprovadas ({instances.length})</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Instâncias com template aprovado</DialogTitle></DialogHeader>
        <Input aria-label="Buscar instância aprovada" placeholder="Buscar nome ou número" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="max-h-80 overflow-auto divide-y">
          {filtered.map(i => <div key={i.id} className="py-3 flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-sm break-words">{i.nome}</p><p className="text-xs text-muted-foreground">{i.telefone}</p></div>{selectedIds.includes(i.id) && <Badge variant="secondary">Selecionada</Badge>}</div>)}
          {!filtered.length && <p className="py-4 text-sm text-muted-foreground">{instances.length ? 'Nenhuma instância encontrada.' : 'Nenhuma instância com este template aprovado.'}</p>}
        </div>
      </DialogContent>
    </Dialog>
  </>;
}