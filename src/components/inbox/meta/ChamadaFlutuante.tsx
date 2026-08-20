import { Phone, PhoneOff, Mic, MicOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMetaCall } from '@/contexts/MetaCallContext';
import { cn } from '@/lib/utils';

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export function ChamadaFlutuante() {
  const { estado, alvo, segundos, mudo, encerrar, alternarMudo } = useMetaCall();
  if (estado === 'idle' || !alvo) return null;

  const rotulo = estado === 'em_andamento'
    ? fmt(segundos)
    : estado === 'chamando' ? 'Chamando...' : estado === 'encerrando' ? 'Encerrando...' : 'Preparando áudio...';

  return (
    <div className="fixed bottom-4 right-4 z-[60] w-[280px] rounded-lg border bg-card shadow-xl p-3 space-y-3">
      <div className="flex items-center gap-2">
        <span className={cn(
          'flex h-9 w-9 items-center justify-center rounded-full',
          estado === 'em_andamento' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-primary/10 text-primary',
        )}>
          {estado === 'em_andamento' ? <Phone className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{alvo.nome || alvo.telefone}</p>
          <p className="text-xs text-muted-foreground tabular-nums">{rotulo}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant={mudo ? 'secondary' : 'outline'}
          size="sm"
          className="flex-1"
          onClick={alternarMudo}
          disabled={estado !== 'em_andamento'}
        >
          {mudo ? <MicOff className="h-4 w-4 mr-1" /> : <Mic className="h-4 w-4 mr-1" />}
          {mudo ? 'Mudo' : 'Microfone'}
        </Button>
        <Button variant="destructive" size="sm" className="flex-1" onClick={() => void encerrar()}>
          <PhoneOff className="h-4 w-4 mr-1" /> Encerrar
        </Button>
      </div>
    </div>
  );
}
