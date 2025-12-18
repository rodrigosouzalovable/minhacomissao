import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, ChevronDown, ChevronUp, AlertTriangle, AlertCircle } from 'lucide-react';
import { usePaymentReminders } from '@/hooks/usePaymentReminders';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function PaymentReminders() {
  const { lembretesHoje, lembretesTresDias, temLembretes, isLoading } = usePaymentReminders();
  const [expanded, setExpanded] = useState(false);

  if (isLoading || !temLembretes) {
    return null;
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="w-full">
      {/* Barra de alertas */}
      <div
        className={cn(
          "flex items-center justify-between px-4 py-2 cursor-pointer transition-colors",
          lembretesHoje.length > 0
            ? "bg-destructive/10 border-b border-destructive/20"
            : "bg-warning/10 border-b border-warning/20"
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4 flex-wrap">
          <Bell className="h-4 w-4 text-foreground" />
          
          {lembretesTresDias.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <span className="text-foreground">
                {lembretesTresDias.length} parcela{lembretesTresDias.length > 1 ? 's' : ''} vence{lembretesTresDias.length > 1 ? 'm' : ''} em 3 dias
              </span>
            </div>
          )}
          
          {lembretesHoje.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="text-foreground font-medium">
                {lembretesHoje.length} parcela{lembretesHoje.length > 1 ? 's' : ''} vence{lembretesHoje.length > 1 ? 'm' : ''} hoje
              </span>
            </div>
          )}
        </div>

        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Lista expandida */}
      {expanded && (
        <div className="bg-card border-b border-border p-4 space-y-4">
          {lembretesHoje.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-destructive mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Vence hoje
              </h4>
              <div className="space-y-2">
                {lembretesHoje.map((lembrete) => (
                  <Link
                    key={lembrete.id}
                    to={`/acordos/${lembrete.acordo_id}`}
                    className="flex items-center justify-between p-2 rounded-lg bg-destructive/5 hover:bg-destructive/10 transition-colors"
                  >
                    <div>
                      <span className="font-medium text-foreground">{lembrete.cliente_nome}</span>
                      <span className="text-muted-foreground text-sm ml-2">
                        Parcela {lembrete.numero_parcela}
                      </span>
                    </div>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(lembrete.valor_parcela)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {lembretesTresDias.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-warning mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Vence em 3 dias
              </h4>
              <div className="space-y-2">
                {lembretesTresDias.map((lembrete) => (
                  <Link
                    key={lembrete.id}
                    to={`/acordos/${lembrete.acordo_id}`}
                    className="flex items-center justify-between p-2 rounded-lg bg-warning/5 hover:bg-warning/10 transition-colors"
                  >
                    <div>
                      <span className="font-medium text-foreground">{lembrete.cliente_nome}</span>
                      <span className="text-muted-foreground text-sm ml-2">
                        Parcela {lembrete.numero_parcela}
                      </span>
                    </div>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(lembrete.valor_parcela)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
