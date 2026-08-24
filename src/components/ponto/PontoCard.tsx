import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Clock, LogIn, UtensilsCrossed, Undo2, LogOut, CheckCircle2, Wifi } from 'lucide-react';
import { usePonto, LABEL_PONTO, ORDEM_PONTO, type PontoTipo, useMeuIpPonto } from '@/hooks/usePonto';

const ICONES: Record<PontoTipo, React.ComponentType<{ className?: string }>> = {
  entrada: LogIn,
  saida_almoco: UtensilsCrossed,
  volta_almoco: Undo2,
  saida: LogOut,
};

function horaBR(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PontoCard({ compacto = false }: { compacto?: boolean }) {
  const { registros, tipos, proximo, bater, isLoading } = usePonto();
  const { data: ipInfo, isError: ipErro } = useMeuIpPonto();
  const [agora, setAgora] = useState(new Date());
  const [erro, setErro] = useState<{ msg: string; codigo?: string } | null>(null);

  useEffect(() => {
    const t = window.setInterval(() => setAgora(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const registrar = (tipo: PontoTipo) => {
    setErro(null);
    bater.mutate(tipo, {
      onSuccess: () => toast.success(`${LABEL_PONTO[tipo]} registrada às ${horaBR(new Date().toISOString())}`),
      onError: (e: Error & { codigo?: string }) => {
        setErro({ msg: e.message, codigo: e.codigo });
        toast.error(e.message);
      },
    });
  };


  const relogio = agora.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Registro de Ponto
        </CardTitle>
        <div className="text-right">
          <p className="font-mono text-xl font-bold tabular-nums">{relogio}</p>
          <p className="text-xs text-muted-foreground">
            {agora.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit' })}
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {ORDEM_PONTO.map((tipo) => {
            const feito = registros.find((r) => r.tipo === tipo);
            const Icone = ICONES[tipo];
            const habilitado = proximo === tipo && !bater.isPending;
            return (
              <div
                key={tipo}
                className={`rounded-lg border p-3 ${feito ? 'border-secondary/40 bg-secondary/5' : proximo === tipo ? 'border-primary/50' : 'opacity-60'}`}
              >
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Icone className="h-4 w-4" />
                  {LABEL_PONTO[tipo]}
                </div>
                {feito ? (
                  <div className="flex items-center gap-1.5 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-secondary" />
                    <span className="font-mono font-semibold">{horaBR(feito.registrado_em)}</span>
                    {feito.origem !== 'auto' && (
                      <Badge variant="outline" className="text-[10px]">ajuste</Badge>
                    )}
                  </div>
                ) : (
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={!habilitado || isLoading}
                    onClick={() => registrar(tipo)}
                  >
                    {bater.isPending && proximo === tipo ? 'Registrando...' : 'Bater ponto'}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {erro && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
            {erro.codigo === 'sem_ip_cadastrado' ? (
              <>
                <p className="font-semibold text-destructive">A rede do escritório ainda não foi liberada</p>
                <p className="text-muted-foreground">
                  Nenhuma rede foi cadastrada no sistema, então o ponto está bloqueado para todos.
                  Avise o administrador para autorizar a rede do escritório — depois disso você poderá bater o ponto.
                </p>
              </>
            ) : erro.codigo === 'ip_nao_autorizado' ? (
              <>
                <p className="font-semibold text-destructive">Você não está na rede do escritório</p>
                <p className="text-muted-foreground">
                  O ponto só pode ser registrado no computador conectado à internet do escritório.
                  Se você já está lá, avise o administrador para autorizar esta rede.
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold text-destructive">Não foi possível registrar o ponto</p>
                <p className="text-muted-foreground">{erro.msg}</p>
              </>
            )}
          </div>
        )}

        {!compacto && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Wifi className="h-3.5 w-3.5" />
              {ipErro
                ? 'Não foi possível verificar a rede'
                : ipInfo
                  ? ipInfo.autorizado
                    ? `Rede autorizada (${ipInfo.ip})`
                    : `Rede não autorizada (${ipInfo.ip})`
                  : 'Verificando rede...'}
            </span>
            <span>{tipos.length}/4 marcações de hoje</span>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
