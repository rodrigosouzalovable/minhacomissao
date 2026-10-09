import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ParcelaDocumento } from '@/lib/acordoDocumento';

interface Props {
  rows: ParcelaDocumento[];
  onChange: (rows: ParcelaDocumento[]) => void;
}

export function ParcelasDocumentoEditor({ rows, onChange }: Props) {
  const update = (index: number, patch: Partial<ParcelaDocumento>) => {
    onChange(rows.map((row, i) => i === index ? { ...row, ...patch } : row));
  };
  return <section className="space-y-3" aria-label="Parcelas do documento">
    <h3 className="font-semibold">Parcelas do documento</h3>
    <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
      {rows.map((row, index) => <div key={index} className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)] items-end gap-3">
        <span className="pb-2 text-sm text-muted-foreground">{index + 1}</span>
        <div className="min-w-0 space-y-1">
          <Label htmlFor={`doc-date-${index}`}>Vencimento {index + 1}</Label>
          <Input id={`doc-date-${index}`} type="date" className="min-w-0" required value={row.data_vencimento}
            onChange={e => update(index, { data_vencimento: e.target.value })} />
        </div>
        <div className="min-w-0 space-y-1">
          <Label htmlFor={`doc-value-${index}`}>Valor {index + 1} (R$)</Label>
          <Input id={`doc-value-${index}`} type="number" inputMode="decimal" min="0.01" step="0.01" required
            value={row.valor || ''} onChange={e => update(index, { valor: Number(e.target.value) })} />
        </div>
      </div>)}
    </div>
  </section>;
}