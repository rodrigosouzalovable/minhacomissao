import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Users, Shield, UserCheck, KeyRound, DollarSign, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ResetPasswordDialog } from '@/components/ResetPasswordDialog';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface UserWithRole {
  id: string;
  nome: string;
  email: string;
  role: AppRole;
  criado_em: string;
}

const roleLabels: Record<AppRole, string> = {
  funcionario: 'Funcionário',
  gestor: 'Gestor',
  admin: 'Admin',
};

const roleBadgeVariants: Record<AppRole, 'default' | 'secondary' | 'destructive'> = {
  funcionario: 'secondary',
  gestor: 'default',
  admin: 'destructive',
};

export default function AdminUsuarios() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<Record<string, AppRole>>({});
  const [resetPasswordUser, setResetPasswordUser] = useState<UserWithRole | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('criado_em', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      // Combine profiles with roles
      const usersWithRoles: UserWithRole[] = profiles.map((profile) => {
        const userRole = roles.find((r) => r.user_id === profile.id);
        return {
          id: profile.id,
          nome: profile.nome,
          email: profile.email,
          role: userRole?.role ?? 'funcionario',
          criado_em: profile.criado_em,
        };
      });

      return usersWithRoles;
    },
  });

  // Filtrar usuários por nome ou email
  const filteredUsers = users?.filter(user =>
    user.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  ) ?? [];

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: AppRole }) => {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({
        title: 'Papel atualizado',
        description: 'O papel do usuário foi atualizado com sucesso.',
      });
    },
    onError: (error) => {
      console.error('Error updating role:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o papel do usuário.',
        variant: 'destructive',
      });
    },
  });

  const handleRoleChange = (userId: string, newRole: AppRole) => {
    setSelectedRole((prev) => ({ ...prev, [userId]: newRole }));
  };

  const handleSaveRole = (userId: string) => {
    const newRole = selectedRole[userId];
    if (newRole) {
      updateRoleMutation.mutate({ userId, newRole });
    }
  };

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const response = await supabase.functions.invoke('reset-user-password', {
        body: { userId, newPassword },
      });

      if (response.error) throw response.error;
      if (!response.data.success) throw new Error(response.data.error);
      
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: 'Senha redefinida',
        description: 'A senha do usuário foi redefinida com sucesso.',
      });
      setResetPasswordUser(null);
    },
    onError: (error: Error) => {
      console.error('Error resetting password:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível redefinir a senha.',
        variant: 'destructive',
      });
    },
  });

  const handleResetPassword = (newPassword: string) => {
    if (resetPasswordUser) {
      resetPasswordMutation.mutate({ userId: resetPasswordUser.id, newPassword });
    }
  };

  const stats = {
    total: users?.length ?? 0,
    admins: users?.filter((u) => u.role === 'admin').length ?? 0,
    gestores: users?.filter((u) => u.role === 'gestor').length ?? 0,
    funcionarios: users?.filter((u) => u.role === 'funcionario').length ?? 0,
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestão de Usuários</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie os usuários e seus papéis no sistema
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Administradores</CardTitle>
              <Shield className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.admins}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Gestores</CardTitle>
              <UserCheck className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.gestores}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Funcionários</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.funcionarios}</div>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle>Usuários</CardTitle>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando usuários...
              </div>
            ) : filteredUsers.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Papel Atual</TableHead>
                    <TableHead>Novo Papel</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.nome}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={roleBadgeVariants[user.role]}>
                          {roleLabels[user.role]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={selectedRole[user.id] ?? user.role}
                          onValueChange={(value: AppRole) => handleRoleChange(user.id, value)}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="funcionario">Funcionário</SelectItem>
                            <SelectItem value="gestor">Gestor</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleSaveRole(user.id)}
                              disabled={
                                !selectedRole[user.id] ||
                                selectedRole[user.id] === user.role ||
                                updateRoleMutation.isPending
                              }
                            >
                              Salvar
                            </Button>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setResetPasswordUser(user)}
                            >
                              <KeyRound className="h-4 w-4 mr-1" />
                              Senha
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/admin/usuarios/${user.id}/comissoes`)}
                            >
                              <DollarSign className="h-4 w-4 mr-1" />
                              Comissões
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum usuário encontrado.
              </div>
            )}
          </CardContent>
        </Card>

        <ResetPasswordDialog
          open={!!resetPasswordUser}
          onOpenChange={(open) => !open && setResetPasswordUser(null)}
          userName={resetPasswordUser?.nome ?? ''}
          onConfirm={handleResetPassword}
          isLoading={resetPasswordMutation.isPending}
        />

      </div>
    </AppLayout>
  );
}
