import { AlertTriangle, Ban, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MetaInstanceHealth {
  saude_status?: string | null;
  saude_quality?: string | null;
  saude_name_status?: string | null;
  saude_ban_info?: any;
  saude_checked_at?: string | null;
}

interface Props {
  instancia?: MetaInstanceHealth | null;
  className?: string;
}

type Nivel = 'critico' | 'alerta' | null;

function avaliar(inst: MetaInstanceHealth | null | undefined): { nivel: Nivel; titulo: string; detalhe: string } | null {
  if (!inst) return null;
  const ban = inst.saude_ban_info;
  const status = (inst.saude_status || '').toUpperCase();
  const qual = (inst.saude_quality || '').toUpperCase();
  const nameSt = (inst.saude_name_status || '').toUpperCase();

  if (ban && (typeof ban === 'object' ? Object.keys(ban).length > 0 : !!ban)) {
    const motivo = (ban as any)?.reason || (ban as any)?.status || 'restrição aplicada';
    return { nivel: 'critico', titulo: 'Este número foi banido/restringido pela Meta', detalhe: `Motivo: ${motivo}. Envios podem falhar até a revisão.` };
  }
  if (status && status !== 'CONNECTED') {
    return { nivel: 'critico', titulo: `Instância ${status}`, detalhe: 'A Meta indica que este número não está totalmente operacional. Envios podem ser bloqueados.' };
  }
  if (qual === 'RED') {
    return { nivel: 'alerta', titulo: 'Qualidade da instância BAIXA', detalhe: 'Muitos bloqueios/reclamações recentes. Reduza envios em massa para evitar restrição.' };
  }
  if (qual === 'YELLOW') {
    return { nivel: 'alerta', titulo: 'Qualidade da instância AMARELA', detalhe: 'Cuidado com o volume — a Meta está monitorando este número.' };
  }
  if (['FLAGGED', 'PENDING_REVIEW', 'REJECTED'].includes(nameSt)) {
    return { nivel: 'alerta', titulo: `Nome do WhatsApp: ${nameSt}`, detalhe: 'O display name está em revisão. Alguns recursos podem ficar limitados.' };
  }
  return null;
}

export function MetaInstanceHealthBanner({ instancia, className }: Props) {
  const info = avaliar(instancia);
  if (!info) return null;
  const isCritico = info.nivel === 'critico';
  const Icon = isCritico ? Ban : info.titulo.includes('Qualidade') ? ShieldAlert : AlertTriangle;
  return (
    <div
      className={cn(
        'px-3 py-2 border-b flex items-start gap-2 text-xs',
        isCritico
          ? 'bg-destructive/10 border-destructive/40 text-destructive'
          : 'bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400',
        className,
      )}
      role="alert"
    >
      <Icon className="h-4 w-4 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="font-semibold leading-tight">{info.titulo}</div>
        <div className="opacity-90 leading-tight">{info.detalhe}</div>
      </div>
    </div>
  );
}
