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
import { useAuth } from '@/hooks/useAuth';
import { navItems } from '@/components/layout/AppLayout';

interface EditPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

// Derivado automaticamente da sidebar (AppLayout.navItems) para manter sincronia
const AVAILABLE_TABS = navItems.map((item) => ({
  path: item.href,
  label: item.label,
}));

const CREDORES = [
  { value: 'ume_novo_mundo', label: 'UME | INADIMPLENTES' },
  { value: 'mundo_da_moda', label: 'UME | APORTE' },
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
  const [inboxCompartilhado, setInboxCompartilhado] = useState(false);
  const [acordosCompartilhados, setAcordosCompartilhados] = useState(false);
  const [permiteCpfDuplicado, setPermiteCpfDuplicado] = useState(false);
  const [podeExcluirAcordos, setPodeExcluirAcordos] = useState(false);
  const [recebeConsultaCpf, setRecebeConsultaCpf] = useState(false);
  const [podeMarcarPago, setPodeMarcarPago] = useState(false);
  const [atendeInboxMeta, setAtendeInboxMeta] = useState(true);
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);

  const { data: allTenants } = useQuery({
    queryKey: ['tenants-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants' as any)
        .select('id, slug, nome, ativo')
        .order('nome');
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: open,
  });

  const { data: userTenantRows } = useQuery({
    queryKey: ['tenant-members', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_members' as any)
        .select('tenant_id')
        .eq('user_id', userId);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: open && !!userId,
  });

  useEffect(() => {
    if (userTenantRows) {
      setSelectedTenants(userTenantRows.map((r: any) => r.tenant_id));
    }
  }, [userTenantRows]);

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
      setInboxCompartilhado((permissions as any).inbox_compartilhado ?? false);
      setAcordosCompartilhados((permissions as any).acordos_compartilhados ?? false);
      setPermiteCpfDuplicado((permissions as any).permite_cpf_duplicado ?? false);
      setPodeExcluirAcordos((permissions as any).pode_excluir_acordos ?? false);
      setRecebeConsultaCpf((permissions as any).recebe_consulta_cpf ?? false);
      setPodeMarcarPago((permissions as any).pode_marcar_pago_global ?? false);
      setAtendeInboxMeta((permissions as any).atende_inbox_meta ?? true);
    } else {
      setSelectedTabs(AVAILABLE_TABS.map((t) => t.path));
      setCredores(['ume_novo_mundo']);
      setVisivelRanking(true);
      setInboxCompartilhado(false);
      setAcordosCompartilhados(false);
      setPermiteCpfDuplicado(false);
      setPodeExcluirAcordos(false);
      setRecebeConsultaCpf(false);
      setPodeMarcarPago(false);
    }
  }, [permissions, open]);

    const { user: currentUser } = useAuth();
    const isSelf = currentUser?.id === userId;

    const saveMutation = useMutation({
    mutationFn: async () => {
        // Garante que /admin/usuarios sempre esteja em abas_permitidas APENAS para o próprio admin logado
        const abasFinal = isSelf && !selectedTabs.includes('/admin/usuarios')
          ? [...selectedTabs, '/admin/usuarios']
          : selectedTabs;
        const payload = {
            abas_permitidas: abasFinal,
            credores,
            visivel_ranking: visivelRanking,
            inbox_compartilhado: inboxCompartilhado,
            acordos_compartilhados: acordosCompartilhados,
            permite_cpf_duplicado: permiteCpfDuplicado,
            pode_excluir_acordos: podeExcluirAcordos,
            recebe_consulta_cpf: recebeConsultaCpf,
            pode_marcar_pago_global: podeMarcarPago,
            concedido_por: (inboxCompartilhado || acordosCompartilhados) ? currentUser?.id : null,
          };
      if (permissions) {
        const { error } = await supabase
          .from('user_permissions')
          .update(payload as any)
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_permissions')
          .insert({
            user_id: userId,
            ...payload,
          } as any);
        if (error) throw error;
      }

      // Sync tenant_members
      const currentIds = new Set((userTenantRows ?? []).map((r: any) => r.tenant_id));
      const selectedIds = new Set(selectedTenants);
      const toAdd = [...selectedIds].filter((id) => !currentIds.has(id));
      const toRemove = [...currentIds].filter((id) => !selectedIds.has(id));
      if (toAdd.length > 0) {
        const { error } = await supabase
          .from('tenant_members' as any)
          .insert(toAdd.map((tenant_id) => ({ tenant_id, user_id: userId, role_tenant: 'member' })));
        if (error) throw error;
      }
      if (toRemove.length > 0) {
        const { error } = await supabase
          .from('tenant_members' as any)
          .delete()
          .eq('user_id', userId)
          .in('tenant_id', toRemove);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-permissions'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-members'] });
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
    if (isSelf && path === '/admin/usuarios') return; // proteção apenas para o próprio admin
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
      <DialogContent className="sm:max-w-md max-h-[70vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Editar Permissões - {userName}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'hsl(var(--border)) transparent' }}>
          <div className="space-y-6 py-4 pr-2">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Abas visíveis</Label>
              {AVAILABLE_TABS.map((tab) => {
                const locked = isSelf && tab.path === '/admin/usuarios';
                return (
                  <div key={tab.path} className="flex items-center gap-2">
                    <Checkbox
                      id={tab.path}
                      checked={locked ? true : selectedTabs.includes(tab.path)}
                      disabled={locked}
                      onCheckedChange={() => toggleTab(tab.path)}
                    />
                    <label htmlFor={tab.path} className={`text-sm ${locked ? 'text-muted-foreground cursor-not-allowed' : 'cursor-pointer'}`}>
                      {tab.label}{locked && ' (obrigatória)'}
                    </label>
                  </div>
                );
              })}
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

            <div className="space-y-3">
              <Label className="text-sm font-medium">Tenants (áreas isoladas)</Label>
              <p className="text-xs text-muted-foreground">
                Marque para dar acesso à URL do tenant (ex: /avatusbarbearia). O usuário só verá dados Meta do tenant vinculado.
              </p>
              {(allTenants ?? []).map((t: any) => (
                <div key={t.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`tenant-${t.id}`}
                    checked={selectedTenants.includes(t.id)}
                    onCheckedChange={() =>
                      setSelectedTenants((prev) =>
                        prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id]
                      )
                    }
                  />
                  <label htmlFor={`tenant-${t.id}`} className="text-sm cursor-pointer">
                    {t.nome} <span className="text-xs text-muted-foreground">/{t.slug}</span>
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

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Inbox Compartilhado</Label>
                <p className="text-xs text-muted-foreground">Permite ver e responder todas as conversas do WhatsApp Inbox</p>
              </div>
              <Switch
                checked={inboxCompartilhado}
                onCheckedChange={setInboxCompartilhado}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Acordos Compartilhados</Label>
                <p className="text-xs text-muted-foreground">Permite ver todos os acordos e instâncias WhatsApp do seu login</p>
              </div>
              <Switch
                checked={acordosCompartilhados}
                onCheckedChange={setAcordosCompartilhados}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Permite CPF duplicado</Label>
                <p className="text-xs text-muted-foreground">Permite lançar acordo mesmo se já houver outro acordo com o mesmo CPF (apenas exibe alerta)</p>
              </div>
              <Switch
                checked={permiteCpfDuplicado}
                onCheckedChange={setPermiteCpfDuplicado}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Pode excluir acordos</Label>
                <p className="text-xs text-muted-foreground">Permite excluir acordos próprios sem parcelas pagas, e excluir parcelas pendentes individualmente. Parcelas pagas ficam protegidas.</p>
              </div>
              <Switch
                checked={podeExcluirAcordos}
                onCheckedChange={setPodeExcluirAcordos}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Receber notificações de consulta de CPF</Label>
                <p className="text-xs text-muted-foreground">Inclui este usuário no rodízio de notificações quando alguém consulta um CPF no portal público. As notificações aparecem no sino do Inbox Meta Oficial.</p>
              </div>
              <Switch
                checked={recebeConsultaCpf}
                onCheckedChange={setRecebeConsultaCpf}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Pode marcar parcelas como pago</Label>
                <p className="text-xs text-muted-foreground">Se desativado, o usuário não conseguirá marcar/desmarcar parcelas de acordos como pagas. Admin sempre pode.</p>
              </div>
              <Switch
                checked={podeMarcarPago}
                onCheckedChange={setPodeMarcarPago}
              />
            </div>

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
