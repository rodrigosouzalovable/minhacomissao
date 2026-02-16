import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, MoreHorizontal } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { TelefoneDialog } from './TelefoneDialog';

interface Telefone {
  id: string;
  numero: string;
  tipo: string;
  is_contato: boolean;
  is_whatsapp: boolean;
  ativo: boolean;
  autorizado: boolean;
  observacao: string | null;
  ramal: string | null;
}

interface TelefoneTabProps {
  telefones: Telefone[];
  cpfNormalizado: string;
  userId: string;
  onRefresh: () => void;
}

const tipoLabel: Record<string, string> = {
  celular: 'Celular',
  comercial: 'Comercial',
  residencial: 'Residencial',
  outro: 'Outro',
};

export function TelefoneTab({ telefones, cpfNormalizado, userId, onRefresh }: TelefoneTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleInativar = async (id: string, currentAtivo: boolean) => {
    const { error } = await supabase.from('devedor_telefones' as any).update({ ativo: !currentAtivo } as any).eq('id', id);
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success(currentAtivo ? 'Telefone inativado' : 'Telefone ativado'); onRefresh(); }
  };

  const handleExcluir = async (id: string) => {
    const { error } = await supabase.from('devedor_telefones' as any).delete().eq('id', id);
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Telefone excluído'); onRefresh(); }
  };

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo
        </Button>
      </div>
      {telefones.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhum telefone cadastrado.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Observação</TableHead>
              <TableHead className="w-[80px]">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {telefones.map((tel) => (
              <TableRow key={tel.id}>
                <TableCell className="font-mono">{tel.numero}</TableCell>
                <TableCell>{tipoLabel[tel.tipo] || tel.tipo}</TableCell>
                <TableCell>{tel.is_whatsapp ? <Badge variant="default">Sim</Badge> : <Badge variant="secondary">Não</Badge>}</TableCell>
                <TableCell>{tel.is_contato ? 'Sim' : 'Não'}</TableCell>
                <TableCell>{tel.ativo ? <Badge variant="default">Ativo</Badge> : <Badge variant="destructive">Inativo</Badge>}</TableCell>
                <TableCell className="max-w-[200px] truncate">{tel.observacao || '-'}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleInativar(tel.id, tel.ativo)}>
                        {tel.ativo ? 'Inativar' : 'Ativar'}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => handleExcluir(tel.id)}>
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <TelefoneDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        cpfNormalizado={cpfNormalizado}
        userId={userId}
        onSaved={onRefresh}
      />
    </div>
  );
}
