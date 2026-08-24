import { useAtividadeMonitor, formatarDuracao } from '@/hooks/useAtividadeMonitor';
import { useUserRole } from '@/hooks/useUserRole';
import { Eye } from 'lucide-react';

/**
 * Aviso flutuante (global) mostrando o tempo de inatividade a partir de 10 minutos.
 * Deixa explícito para o funcionário que a atividade é monitorada.
 */
export function InatividadeFlutuante() {
  const { isAdmin, loading } = useUserRole();
  const { inativo, segundos } = useAtividadeMonitor(!loading);

  if (!inativo || isAdmin) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] pointer-events-none">
      <div className="flex items-center gap-3 rounded-lg border border-warning/40 bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-warning" />
        </span>
        <div className="leading-tight">
          <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
            <Eye className="h-3.5 w-3.5" />
            Inatividade detectada
          </p>
          <p className="font-mono text-lg font-bold tabular-nums text-foreground">
            {formatarDuracao(segundos)}
          </p>
          <p className="text-[11px] text-muted-foreground">Sua atividade está sendo monitorada</p>
        </div>
      </div>
    </div>
  );
}
