// Janela de envio Meta (horário BRT + bloqueio de domingo).
// Usado pelos motores de disparo para reagendar exatamente na abertura da janela,
// em vez de esperar um backoff fixo longo.

export type JanelaEnvio = {
  aberta: boolean;
  esperaMs: number;
  aberturaBrtLabel: string;
};

const MAX_RECHECK_MS = 30_000;

function nowBrt(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
}

function horaDe(valor: unknown, fallback: number): number {
  const [h] = String(valor ?? '').split(':').map(Number);
  return Number.isFinite(h) ? h : fallback;
}

/**
 * Calcula quanto falta (ms) para a janela de envio estar aberta.
 * Se já está aberta, devolve `esperaMs = 0`.
 */
export async function calcularJanelaEnvio(supabase: any): Promise<JanelaEnvio> {
  const { data: cfg } = await supabase
    .from('meta_envio_pool_config')
    .select('horario_inicio, horario_fim, bloquear_domingo')
    .eq('id', 1)
    .maybeSingle();

  const hIni = horaDe(cfg?.horario_inicio, 8);
  const hFim = horaDe(cfg?.horario_fim, 20);
  const bloquearDomingo = cfg?.bloquear_domingo === true;

  const brt = nowBrt();
  const label = `${String(hIni).padStart(2, '0')}:00`;

  // Próxima abertura válida (hoje ou nos próximos dias, pulando domingo se bloqueado)
  const abertura = new Date(brt);
  abertura.setHours(hIni, 0, 0, 0);

  const dentroHorario = brt.getHours() + brt.getMinutes() / 60 >= hIni
    && brt.getHours() + brt.getMinutes() / 60 < hFim;
  const domingoBloqueado = bloquearDomingo && brt.getDay() === 0;

  if (dentroHorario && !domingoBloqueado) {
    return { aberta: true, esperaMs: 0, aberturaBrtLabel: label };
  }

  // Se já passou do fim do dia (ou é domingo bloqueado), joga para o próximo dia válido
  if (abertura.getTime() <= brt.getTime()) abertura.setDate(abertura.getDate() + 1);
  for (let i = 0; i < 8; i++) {
    if (bloquearDomingo && abertura.getDay() === 0) {
      abertura.setDate(abertura.getDate() + 1);
      continue;
    }
    break;
  }

  const esperaMs = Math.max(1_000, abertura.getTime() - brt.getTime());
  return { aberta: false, esperaMs, aberturaBrtLabel: label };
}

/**
 * Espera a usar quando o motor recebeu bloqueio de horário/domingo:
 * exatamente até a abertura da janela; se a janela já abriu, recheca em 30s no máximo.
 */
export async function esperaAteJanela(supabase: any): Promise<number> {
  const j = await calcularJanelaEnvio(supabase);
  return j.aberta ? Math.min(MAX_RECHECK_MS, 5_000) : j.esperaMs;
}
