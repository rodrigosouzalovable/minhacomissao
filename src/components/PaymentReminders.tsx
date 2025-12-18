import { Link } from 'react-router-dom';
import { Bell, AlertTriangle, AlertCircle, X } from 'lucide-react';
import { usePaymentReminders } from '@/hooks/usePaymentReminders';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export function PaymentReminders() {
  const { lembretesHoje, lembretesTresDias, temLembretes, isLoading, marcarComoLido } = usePaymentReminders();

  const totalLembretes = lembretesHoje.length + lembretesTresDias.length;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleMarcarLido = (e: React.MouseEvent, pagamentoId: string) => {
    e.preventDefault();
    e.stopPropagation();
    marcarComoLido(pagamentoId);
  };

  if (isLoading) {
    return (
      <Button variant="ghost" size="icon" className="relative">
        <Bell className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {totalLembretes > 0 && (
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
              {totalLembretes > 9 ? '9+' : totalLembretes}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        {!temLembretes ? (
          <div className="p-4 text-center text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhum lembrete pendente</p>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {lembretesHoje.length > 0 && (
              <div className="p-3 border-b border-border">
                <h4 className="text-sm font-semibold text-destructive mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Vence hoje
                </h4>
                <div className="space-y-2">
                  {lembretesHoje.map((lembrete) => (
                    <div
                      key={lembrete.id}
                      className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 transition-colors"
                    >
                      <Link
                        to={`/acordos/${lembrete.acordo_id}`}
                        className="flex items-center justify-between flex-1 min-w-0"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-medium text-foreground text-sm block truncate">
                            {lembrete.cliente_nome}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            Parcela {lembrete.numero_parcela}
                          </span>
                        </div>
                        <span className="font-semibold text-foreground text-sm ml-2">
                          {formatCurrency(lembrete.valor_parcela)}
                        </span>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 hover:bg-destructive/30"
                        onClick={(e) => handleMarcarLido(e, lembrete.id)}
                        title="Marcar como lido"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {lembretesTresDias.length > 0 && (
              <div className="p-3">
                <h4 className="text-sm font-semibold text-warning mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Vence em 3 dias
                </h4>
                <div className="space-y-2">
                  {lembretesTresDias.map((lembrete) => (
                    <div
                      key={lembrete.id}
                      className="flex items-center gap-2 p-2 rounded-lg bg-warning/10 hover:bg-warning/20 transition-colors"
                    >
                      <Link
                        to={`/acordos/${lembrete.acordo_id}`}
                        className="flex items-center justify-between flex-1 min-w-0"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-medium text-foreground text-sm block truncate">
                            {lembrete.cliente_nome}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            Parcela {lembrete.numero_parcela}
                          </span>
                        </div>
                        <span className="font-semibold text-foreground text-sm ml-2">
                          {formatCurrency(lembrete.valor_parcela)}
                        </span>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 hover:bg-warning/30"
                        onClick={(e) => handleMarcarLido(e, lembrete.id)}
                        title="Marcar como lido"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
