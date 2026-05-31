import { AlertCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export interface AcaoHint {
  label: string;
  onClick?: () => void;
  to?: string;
}

interface Props {
  motivo: string;
  acao?: AcaoHint;
  className?: string;
}

export function CampoZeradoHint({ motivo, acao, className }: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={
            'inline-flex items-center justify-center rounded-full text-amber-500 hover:text-amber-600 transition-colors print:hidden ' +
            (className ?? '')
          }
          aria-label="Por que está zerado?"
        >
          <AlertCircle className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 text-sm space-y-2">
        <p className="font-medium text-foreground">Por que está zerado?</p>
        <p className="text-muted-foreground whitespace-pre-wrap">{motivo}</p>
        {acao && (
          acao.to ? (
            <Button asChild size="sm" className="w-full mt-2">
              <Link to={acao.to}>{acao.label}</Link>
            </Button>
          ) : (
            <Button size="sm" className="w-full mt-2" onClick={acao.onClick}>
              {acao.label}
            </Button>
          )
        )}
      </PopoverContent>
    </Popover>
  );
}
