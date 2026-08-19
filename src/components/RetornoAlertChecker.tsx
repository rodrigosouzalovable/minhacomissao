import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Bell, User, Phone, FileText, CalendarClock } from 'lucide-react';
import successSound from '@/assets/success-sound.mp3';

interface RetornoAlerta {
  id: string;
  cliente_nome: string;
  cliente_cpf: string;
  cliente_telefone: string;
  observacao: string | null;
  data_retorno: string;
}

export function RetornoAlertChecker() {
  const { user } = useAuth();
  const [fila, setFila] = useState<RetornoAlerta[]>([]);
  const notifiedIds = useRef<Set<string>>(new Set());

  const alertaRetorno = fila[0] ?? null;

  const checkRetornos = useCallback(async () => {
    if (!user) return;

    const now = new Date();
    // data_retorno é gravado em UTC real — comparar direto, sem deslocar fuso.
    const past60Min = new Date(now.getTime() - 60 * 60 * 1000);
    const in2Min = new Date(now.getTime() + 2 * 60 * 1000);

    const { data, error } = await supabase
      .from('retornos')
      .select('id, cliente_nome, cliente_cpf, cliente_telefone, observacao, data_retorno')
      .eq('user_id', user.id)
      .eq('status', 'pendente')
      .lte('data_retorno', in2Min.toISOString())
      .gte('data_retorno', past60Min.toISOString())
      .order('data_retorno', { ascending: true });

    if (error || !data || data.length === 0) return;

    const novos = data.filter((r) => !notifiedIds.current.has(r.id));
    if (novos.length === 0) return;

    novos.forEach((r) => notifiedIds.current.add(r.id));
    setFila((prev) => [...prev, ...novos]);

    // Play sound
    try {
      const audio = new Audio(successSound);
      await audio.play();
      setTimeout(() => {
        const audio2 = new Audio(successSound);
        audio2.play().catch(() => {});
      }, 500);
    } catch {}
  }, [user]);

  useEffect(() => {
    if (!user) return;

    // Check immediately
    checkRetornos();

    // Poll every 2 minutes; pause when tab is hidden to save CPU/network.
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') checkRetornos();
    }, 120000);

    const onVisible = () => {
      if (document.visibilityState === 'visible') checkRetornos();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user, checkRetornos]);

  const fechar = () => setFila((prev) => prev.slice(1));

  const concluir = async () => {
    if (!alertaRetorno) return;
    await supabase.from('retornos').update({ status: 'concluido' }).eq('id', alertaRetorno.id);
    fechar();
  };

  return (
    <AlertDialog open={!!alertaRetorno} onOpenChange={(open) => { if (!open) fechar(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            🔔 Retorno Agendado!
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 pt-2">
              <p className="text-base font-medium text-foreground">
                Você precisa entrar em contato com este cliente agora:
              </p>
              <div className="space-y-2 rounded-lg bg-muted p-3">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">{alertaRetorno?.cliente_nome}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CalendarClock className="h-3 w-3 text-muted-foreground" />
                  <span>
                    {alertaRetorno
                      ? new Date(alertaRetorno.data_retorno).toLocaleString('pt-BR', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })
                      : ''}
                  </span>
                </div>
                {!!alertaRetorno?.cliente_cpf && (
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-3 w-3 text-muted-foreground" />
                    <span>CPF: {alertaRetorno.cliente_cpf}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-3 w-3 text-muted-foreground" />
                  <span>{alertaRetorno?.cliente_telefone}</span>
                </div>
                {alertaRetorno?.observacao && (
                  <p className="text-sm text-muted-foreground mt-2 border-t pt-2">
                    {alertaRetorno.observacao}
                  </p>
                )}
              </div>
              {fila.length > 1 && (
                <p className="text-xs text-muted-foreground">
                  +{fila.length - 1} outro(s) retorno(s) aguardando.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={fechar}>Entendido</AlertDialogCancel>
          <AlertDialogAction onClick={concluir}>Marcar como concluído</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
