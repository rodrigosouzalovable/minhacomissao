import { ReactNode } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { usePonto } from '@/hooks/usePonto';
import { PontoCard } from './PontoCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { LogOut, ShieldAlert } from 'lucide-react';

/**
 * Bloqueio total: enquanto o funcionário não registrar a entrada do dia
 * (ou a volta do almoço, quando saiu e não voltou), só a tela de ponto é exibida.
 * Admins e gestores nunca são bloqueados.
 */
export function PontoGate({ children }: { children: ReactNode }) {
  const { isAdmin, isGestor, loading: roleLoading } = useUserRole();
  const { entradaOk, emAlmoco, isLoading } = usePonto();
  const { signOut } = useAuth();

  if (roleLoading || isLoading) return <>{children}</>;
  if (isAdmin || isGestor) return <>{children}</>;

  const bloqueado = !entradaOk || emAlmoco;
  if (!bloqueado) return <>{children}</>;

  return (
    <div className="mx-auto max-w-3xl space-y-4 py-6">
      <Card className="border-warning/40">
        <CardContent className="flex items-start gap-3 p-4">
          <ShieldAlert className="mt-0.5 h-5 w-5 text-warning" />
          <div>
            <p className="font-semibold">
              {emAlmoco ? 'Você está em horário de almoço' : 'Registre sua entrada para liberar o sistema'}
            </p>
            <p className="text-sm text-muted-foreground">
              {emAlmoco
                ? 'Clique em "Volta do almoço" para voltar a usar o sistema.'
                : 'O registro de ponto é obrigatório e só pode ser feito na rede do escritório.'}
            </p>
          </div>
        </CardContent>
      </Card>

      <PontoCard />

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => signOut()}>
          <LogOut className="mr-2 h-4 w-4" />
          Sair da conta
        </Button>
      </div>
    </div>
  );
}
