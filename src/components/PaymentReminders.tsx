import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, AlertTriangle, AlertCircle, Check, History, RotateCcw } from 'lucide-react';
import { usePaymentReminders } from '@/hooks/usePaymentReminders';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function PaymentReminders() {
  const { lembretesHoje, lembretesTresDias, lembretesJaLidos, temLembretes, isLoading, marcarComoLido, desmarcarLido } = usePaymentReminders();
  const [activeTab, setActiveTab] = useState('pendentes');

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

  const handleDesmarcarLido = (e: React.MouseEvent, pagamentoId: string) => {
    e.preventDefault();
    e.stopPropagation();
    desmarcarLido(pagamentoId);
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-2 rounded-none border-b">
            <TabsTrigger value="pendentes" className="gap-1.5">
              <Bell className="h-3.5 w-3.5" />
              Pendentes
              {totalLembretes > 0 && (
                <span className="ml-1 text-xs bg-destructive text-destructive-foreground rounded-full px-1.5">
                  {totalLembretes}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="historico" className="gap-1.5">
              <History className="h-3.5 w-3.5" />
              Histórico
              {lembretesJaLidos.length > 0 && (
                <span className="ml-1 text-xs bg-muted-foreground/20 text-muted-foreground rounded-full px-1.5">
                  {lembretesJaLidos.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pendentes" className="mt-0">
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
                            className="h-6 w-6 shrink-0 hover:bg-accent hover:text-accent-foreground"
                            onClick={(e) => handleMarcarLido(e, lembrete.id)}
                            title="Marcar como visto"
                          >
                            <Check className="h-3 w-3" />
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
                            className="h-6 w-6 shrink-0 hover:bg-accent hover:text-accent-foreground"
                            onClick={(e) => handleMarcarLido(e, lembrete.id)}
                            title="Marcar como visto"
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="historico" className="mt-0">
            {lembretesJaLidos.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Nenhum lembrete no histórico</p>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto p-3">
                <div className="space-y-2">
                  {lembretesJaLidos.map((lembrete) => (
                    <div
                      key={lembrete.id}
                      className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
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
                            Parcela {lembrete.numero_parcela} • {lembrete.tipo === 'hoje' ? 'Vence hoje' : 'Vence em 3 dias'}
                          </span>
                        </div>
                        <span className="font-semibold text-foreground text-sm ml-2">
                          {formatCurrency(lembrete.valor_parcela)}
                        </span>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 hover:bg-accent hover:text-accent-foreground"
                        onClick={(e) => handleDesmarcarLido(e, lembrete.id)}
                        title="Mostrar novamente"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
