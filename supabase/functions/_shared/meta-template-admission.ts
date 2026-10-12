import { claimTemplatePacing, finishTemplatePacing, deferTemplate } from './meta-template-pacing.ts';
import { nextTemplateDay } from './meta-template-completion.ts';
import { reservarEnvioTemplateTier250, finalizarEnvioTemplateTier250 } from './meta-template-tier-protection.ts';

/** A failed queue entry must never abort another number's admitted submission. */
export async function admitTemplateInstances<T extends { id: string }>(
  db: any, instances: T[], masterId: string, origin: string,
) {
  const admitted: T[] = [];
  const deferred: Array<{ instancia_id: string; motivo: string; agendado_para: string }> = [];
  const ignored: Array<{ instancia_id: string; motivo: string }> = [];
  const tokens = new Map<string, string>();
  for (const inst of instances) {
    let token: string | undefined;
    let reserved = false;
    let retained = false;
    try {
      const pacing = await claimTemplatePacing(db, inst.id, masterId);
      token = pacing.token;
      if (!pacing.allowed) {
        if (pacing.existing) {
          ignored.push({ instancia_id: inst.id, motivo: 'submissao_existente_preservada' });
          continue;
        }
        await deferTemplate(db, inst.id, masterId, pacing.next_allowed_at, 'aguardando intervalo de 2–5 minutos ou aplicação em andamento na BM');
        deferred.push({ instancia_id: inst.id, motivo: 'intervalo_2_5_min', agendado_para: pacing.next_allowed_at });
        continue;
      }
      const slot = await reservarEnvioTemplateTier250(db, inst.id, masterId, origin);
      reserved = slot === 'reserved';
      if (slot === 'limit_reached' || slot === 'already_reserved') {
        const when = nextTemplateDay().toISOString();
        await deferTemplate(db, inst.id, masterId, when, 'aguardando cota diária tier 250');
        deferred.push({ instancia_id: inst.id, motivo: 'limite_tier_250', agendado_para: when });
        continue;
      }
      if (token) tokens.set(inst.id, token);
      admitted.push(inst);
      retained = true;
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Falha ao reservar aplicação deste número.';
      if (reserved) await finalizarEnvioTemplateTier250(db, inst.id, masterId, 'FALHA', reason);
      ignored.push({ instancia_id: inst.id, motivo: reason });
    } finally {
      if (!retained) await finishTemplatePacing(db, token);
    }
  }
  return { admitted, deferred, ignored, tokens };
}