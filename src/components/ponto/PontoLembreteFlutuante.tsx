import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AlarmClock, X, UtensilsCrossed, LogOut } from 'lucide-react';
import { usePonto, LABEL_PONTO, type PontoTipo } from '@/hooks/usePonto';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useUserRole } from '@/hooks/useUserRole';

const SNOOZE_MIN = 30;

/** Minutos desde a meia-noite no fuso de Brasília */
function minutosBRT(d = new Date()): number {
  const [h, m] = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(d)
    .split(':')
    .map(Number);
  return h * 60 + m;
}

function domingoBRT(d = new Date()): boolean {
  const s = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' }).format(d);
  return s === 'Sun';
}

const ICONES: Partial<Record<PontoTipo, React.ComponentType<{ className?: string }>>> = {
  saida_almoco: UtensilsCrossed,
  saida: LogOut,
};

/**
 * Lembrete flutuante global: a partir das 11:00 BRT cobra a saída para almoço
 * e a partir das 16:30 BRT cobra a saída do dia (só para quem bate ponto).
 */
export function PontoLembreteFlutuante() {
  const { isAdmin, isGestor, loading: roleLoading } = useUserRole();
  const { batePonto, isLoading: permLoading } = useUserPermissions();
  const { tipos, proximo, bater, entradaOk } = usePonto();
  const [minutos, setMinutos] = useState(() => minutosBRT());
  const [snoozeAte, setSnoozeAte] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => setMinutos(minutosBRT()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  if (roleLoading || permLoading || isAdmin || isGestor || !batePonto) return null;
  if (domingoBRT() || !entradaOk || tipos.includes('saida')) return null;
  if (Date.now() < snoozeAte) return null;

  let alvo: PontoTipo | null = null;
  if (minutos >= 16 * 60 + 30 && !tipos.includes('saida')) alvo = 'saida';
  else if (minutos >= 11 * 60 && !tipos.includes('saida_almoco')) alvo = 'saida_almoco';

  // só cobra quando é realmente a próxima marcação da sequência
  if (!alvo || proximo !== alvo) return null;

  const Icone = ICONES[alvo] ?? AlarmClock;

  const registrar = () => {
    bater.mutate(alvo!, {
      onSuccess: () => toast.success(`${LABEL_PONTO[alvo!]} registrada`),
      onError: (e: Error) => toast.error(e.message),
    });
  };

  return (
    <div className="fixed bottom-4 left-4 z-[100] w-[290px]">
      <div className="rounded-lg border border-primary/40 bg-card/95 p-3 shadow-lg backdrop-blur">
        <div className="mb-2 flex items-start gap-2">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icone className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Lembrete de ponto</p>
            <p className="text-xs text-muted-foreground">
              Você ainda não registrou <strong>{LABEL_PONTO[alvo]}</strong>.
            </p>
          </div>
          <button
            type="button"
            aria-label="Dispensar por 30 minutos"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => setSnoozeAte(Date.now() + SNOOZE_MIN * 60_000)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" disabled={bater.isPending} onClick={registrar}>
            {bater.isPending ? 'Registrando...' : 'Bater ponto agora'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSnoozeAte(Date.now() + SNOOZE_MIN * 60_000)}
          >
            Depois
          </Button>
        </div>
      </div>
    </div>
  );
}
