import { EMPRESAS_ACORDO, getEmpresaLabel } from '@/lib/empresaLabels';
import type { TotaisCredor } from '@/lib/recebimentosPorCredor';
import { cn } from '@/lib/utils';

export function RecebimentosCredores({ valores, className }: { valores: TotaisCredor; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-1 gap-1 text-xs', className)}>
      {EMPRESAS_ACORDO.map(credor => (
        <div key={credor} className="flex min-w-0 flex-wrap justify-between gap-x-3 gap-y-0.5">
          <dt className="text-muted-foreground">{getEmpresaLabel(credor)}</dt>
          <dd className="font-semibold tabular-nums">{valores[credor].toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</dd>
        </div>
      ))}
    </dl>
  );
}