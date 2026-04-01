import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';

interface EditPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

const AVAILABLE_TABS = [
  { path: '/conta', label: 'Minha Conta' },
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/acordos', label: 'Meus Acordos' },
  { path: '/acordos/novo', label: 'Novo Acordo' },
  { path: '/retornos', label: 'Retornos' },
  { path: '/clientes', label: 'Clientes' },
  { path: '/comissoes', label: 'Minhas Comissões' },
  { path: '/equipe/acordos', label: 'Acordos da Equipe' },
  { path: '/admin/usuarios', label: 'Usuários' },
  { path: '/admin/equipes', label: 'Equipes' },
  { path: '/admin/auditoria', label: 'Auditoria' },
  { path: '/admin/financeiro', label: 'Financeiro' },
  { path: '/admin/importar-devedores', label: 'Importar Devedores' },
  { path: '/admin/acionamento', label: 'Acionamento' },
  { path: '/admin/automacao-cobmais', label: 'Automação CobMais' },
  { path: '/meta', label: 'Meta' },
  { path: '/campanhas-voz', label: 'Campanhas de Voz' },
  { path: '/inbox', label: 'WhatsApp Inbox' },
  { path: '/aquecimento', label: 'Aquecimento' },
];

const CREDORES = [
  { value: 'ume_novo_mundo', label: 'UME / NOVO MUNDO' },
  { value: 'mundo_da_moda', label: 'MUNDO DA MODA' },
  { value: 'montreal', label: 'MONTREAL' },
];

export function EditPermissionsDialog({
  open,
  onOpenChange,
  userId,
  userName,
}: EditPermissionsDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTabs, setSelectedTabs] = useState<string[]>(
    AVAILABLE_TABS.map((t) => t.path)
  );
  const [credores, setCredores] = useState<string[]>(['ume_novo_mundo']);
  const [visivelRanking, setVisivelRanking] = useState(true);

  const { data: permissions } = useQuery({
    queryKey: ['user-permissions', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open && !!userId,
  });

  useEffect(() => {
    if (permissions) {
      setSelectedTabs(permissions.abas_permitidas);
      setCredores((permissions as any).credores ?? ['ume_novo_mundo']);
      setVisivelRanking((permissions as any).visivel_ranking ?? true);
    } else {
      setSelectedTabs(AVAILABLE_TABS.map((t) => t.path));
      setCredores(['ume_novo_mundo']);
      setVisivelRanking(true);
    }
  }, [permissions, open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (permissions) {
        const { error } = await supabase
          .from('user_permissions')
          .update({
            abas_permitidas: selectedTabs,
            credores,
            visivel_ranking: visivelRanking,
          } as any)
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_permissions')
          .insert({
            user_id: userId,
            abas_permitidas: selectedTabs,
            credores,
            visivel_ranking: visivelRanking,
          } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-permissions'] });
      onOpenChange(false);
      toast({
        title: 'Permissões salvas',
        description: `Permissões de ${userName} atualizadas com sucesso.`,
      });
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar as permissões.',
        variant: 'destructive',
      });
    },
  });

  const toggleTab = (path: string) => {
    setSelectedTabs((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  };

  const toggleCredor = (value: string) => {
    setCredores((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Permissões - {userName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label className="text-sm font-medium">Abas visíveis</Label>
            {AVAILABLE_TABS.map((tab) => (
              <div key={tab.path} className="flex items-center gap-2">
                <Checkbox
                  id={tab.path}
                  checked={selectedTabs.includes(tab.path)}
                  onCheckedChange={() => toggleTab(tab.path)}
                />
                <label htmlFor={tab.path} className="text-sm cursor-pointer">
                  {tab.label}
                </label>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Credores vinculados</Label>
            {CREDORES.map((credor) => (
              <div key={credor.value} className="flex items-center gap-2">
                <Checkbox
                  id={`credor-${credor.value}`}
                  checked={credores.includes(credor.value)}
                  onCheckedChange={() => toggleCredor(credor.value)}
                />
                <label htmlFor={`credor-${credor.value}`} className="text-sm cursor-pointer">
                  {credor.label}
                </label>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Visível no Ranking</Label>
            <Switch
              checked={visivelRanking}
              onCheckedChange={setVisivelRanking}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
