import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

const LIMITE_INATIVIDADE_MS = 10 * 60 * 1000; // 10 minutos
const HEARTBEAT_MS = 60 * 1000; // envia no máximo 1 batimento por minuto
const EVENTOS = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

interface Estado {
  inativo: boolean;
  segundos: number;
}

/**
 * Observa interação do usuário. Após 10 minutos sem interação marca como inativo
 * e devolve o cronômetro (em segundos) para exibição flutuante.
 * Economia de custo: no máximo 1 escrita por minuto e nenhuma quando a aba está oculta.
 */
export function useAtividadeMonitor(ativo: boolean) {
  const { user } = useAuth();
  const [estado, setEstado] = useState<Estado>({ inativo: false, segundos: 0 });
  const ultimaInteracao = useRef<number>(Date.now());
  const ultimoEnvio = useRef<number>(0);
  const estadoEnviado = useRef<'ativo' | 'inativo' | null>(null);

  useEffect(() => {
    if (!ativo || !user) return;

    const enviar = async (est: 'ativo' | 'inativo') => {
      const agora = Date.now();
      if (est === estadoEnviado.current && agora - ultimoEnvio.current < HEARTBEAT_MS) return;
      ultimoEnvio.current = agora;
      estadoEnviado.current = est;
      try {
        await supabase.functions.invoke('ponto-atividade-heartbeat', {
          body: {
            estado: est,
            pagina: window.location.pathname,
            inativo_desde: est === 'inativo'
              ? new Date(ultimaInteracao.current).toISOString()
              : undefined,
          },
        });
      } catch {
        /* silencioso: monitoramento não deve atrapalhar o uso */
      }
    };

    const marcarInteracao = () => {
      ultimaInteracao.current = Date.now();
      if (estado.inativo) setEstado({ inativo: false, segundos: 0 });
      if (document.visibilityState === 'visible') void enviar('ativo');
    };

    EVENTOS.forEach((ev) =>
      window.addEventListener(ev, marcarInteracao, { passive: true }),
    );
    const onVisibility = () => {
      if (document.visibilityState === 'visible') marcarInteracao();
    };
    document.addEventListener('visibilitychange', onVisibility);

    void enviar('ativo');

    const timer = window.setInterval(() => {
      // Aba oculta: congela a contagem (não acumula tempo nem grava janela falsa)
      if (document.visibilityState !== 'visible') {
        ultimaInteracao.current = Date.now();
        if (estado.inativo) setEstado({ inativo: false, segundos: 0 });
        return;
      }
      const decorrido = Date.now() - ultimaInteracao.current;
      if (decorrido >= LIMITE_INATIVIDADE_MS) {
        setEstado({ inativo: true, segundos: Math.floor(decorrido / 1000) });
        void enviar('inativo');
      } else if (estado.inativo) {
        setEstado({ inativo: false, segundos: 0 });
      }
    }, 1000);


    return () => {
      EVENTOS.forEach((ev) => window.removeEventListener(ev, marcarInteracao));
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, user, estado.inativo]);

  return estado;
}

export function formatarDuracao(segundos: number): string {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
