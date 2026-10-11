import { describe, expect, it } from 'bun:test';
import { approvedOwnerModels, isInternalSlotFailure, nextTemplateDay, readAllTemplateRows } from '../supabase/functions/_shared/meta-template-completion';
import { TIER_250_TEMPLATE_LIMIT } from '../supabase/functions/_shared/meta-template-tier-protection';
import { modelosParaCopiar } from '../supabase/functions/_shared/meta-template-copy-candidates';

describe('complete template application', () => {
  const owners = new Map([['source', 'owner'], ['foreign', 'other']]);
  const master = { id: 'm', nome: 'approved_model', idioma: 'pt_BR', categoria: 'UTILITY', criado_por: 'owner', injetar_em_novos: false };
  const copy = { instancia_id: 'source', nome_template: 'approved_model', idioma: 'pt_BR', categoria: 'UTILITY', status: 'approved' };
  it('includes preapproved Utility models even when the old automatic flag is off', () => {
    expect(approvedOwnerModels([master], [copy], owners).map(m => m.id)).toEqual(['m']);
  });
  it('requires approval from the same owner, language and Utility category', () => {
    expect(approvedOwnerModels([master], [{ ...copy, instancia_id: 'foreign' }], owners)).toEqual([]);
    expect(approvedOwnerModels([master], [{ ...copy, idioma: 'en_US' }], owners)).toEqual([]);
    expect(approvedOwnerModels([master], [{ ...copy, categoria: 'MARKETING' }], owners)).toEqual([]);
    expect(approvedOwnerModels([master], [{ ...copy, status: 'pending' }], owners)).toEqual([]);
    expect(approvedOwnerModels([{ ...master, categoria: 'MARKETING' }], [copy], owners)).toEqual([]);
  });
  it('only recovers the identified internal reservation failure, not real Meta refusals', () => {
    expect(isInternalSlotFailure('new row violates meta_template_daily_reservations_slot_check')).toBe(true);
    expect(isInternalSlotFailure('Meta error 141006: payment method')).toBe(false);
    expect(isInternalSlotFailure('Meta rejected template')).toBe(false);
  });
  it('preserves two per day for tier 250', () => expect(TIER_250_TEMPLATE_LIMIT).toBe(2));
  it('rolls over to Sunday midnight BRT and never skips Sunday', () => {
    expect(nextTemplateDay(new Date('2026-10-11T02:00:00Z')).toISOString()).toBe('2026-10-11T03:00:00.000Z');
    expect(nextTemplateDay(new Date('2026-10-11T04:00:00Z')).toISOString()).toBe('2026-10-12T03:00:00.000Z');
  });
  it('never repeats existing or queued models', () => {
    const models = ['approved', 'pending', 'queued', 'new'].map(id => ({ ...master, id, nome: id }));
    expect(modelosParaCopiar(models, new Set(['approved']), new Set(['pending|pt_BR']), new Set(['queued'])).map(m => m.id)).toEqual(['new']);
  });
  it('reads beyond the first 1000 records for accurate coverage and progress', async () => {
    const records = Array.from({ length: 3335 }, (_, id) => ({ id }));
    let reads = 0;
    const result = await readAllTemplateRows(() => ({ order: () => ({ range: async (a: number, b: number) => {
      reads++;
      return { data: records.slice(a, b + 1), error: null };
    } }) }));
    expect(result.length).toBe(3335);
    expect(result.at(-1)?.id).toBe(3334);
    expect(reads).toBe(4);
  });
  it('a failed page is never treated as an empty or complete catalogue', async () => {
    await expect(readAllTemplateRows(() => ({ order: () => ({ range: async () => ({ data: null, error: new Error('incomplete read') }) }) }))).rejects.toThrow('incomplete read');
  });
});