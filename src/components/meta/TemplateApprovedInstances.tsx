import { Button } from '@/components/ui/button';
import { ListChecks } from 'lucide-react';

export default function TemplateApprovedInstances({ count, onSelect, disabled = false }: {
  count: number;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return <Button type="button" size="sm" variant="outline" className="h-auto min-h-9 max-w-full whitespace-normal text-left" disabled={disabled || count === 0} onClick={onSelect}>
    <ListChecks className="h-4 w-4 mr-2 shrink-0" />Selecionar instâncias aprovadas ({count})
  </Button>;
}