import { describe, expect, it } from 'bun:test';
import { podeDistribuirModelo, preservarSubmissao, registroReclassificacao } from '../supabase/functions/_shared/meta-template-distribution';
import { motivoBloqueioTemplate } from '../supabase/functions/_shared/meta-template-eligibility';

describe('distribution independent of reclassification', () => {
  it('continues for all models after a copy becomes Marketing', () => {
    const models = ['duvidas_ou_informacoes_gui_2', 'outro_modelo'].map(nome => ({ nome, categoria: 'UTILITY', criado_por: 'owner', reclassificado_marketing: true }));
    expect(models.flatMap(m => ['a', 'b', 'c'].filter(() => podeDistribuirModelo(m, 'owner', true)))).toEqual(['a', 'b', 'c', 'a', 'b', 'c']);
  });
  it('does not cross owners', () => expect(podeDistribuirModelo({ categoria: 'UTILITY', criado_por: 'other', reclassificado_marketing: true }, 'owner')).toBe(false));
  it('preserves approved and pending copies', () => {
    expect(preservarSubmissao('APPROVED')).toBe(true);
    expect(preservarSubmissao('pending')).toBe(true);
    expect(preservarSubmissao('FALHA_ENVIO')).toBe(false);
  });
  it('keeps category warning and distribution selection without enabling messages', () => {
    expect({ injetar_em_novos: true, categoria: 'UTILITY', ...registroReclassificacao() }).toEqual({ injetar_em_novos: true, categoria: 'UTILITY', usar_em_leads: false, reclassificado_marketing: true, categoria_meta: 'MARKETING' });
  });
  it('does not extend automatic distribution to Marketing masters', () => expect(podeDistribuirModelo({ categoria: 'MARKETING', criado_por: 'owner' }, 'owner', true)).toBe(false));
  it('keeps YELLOW/RED and real blocks out', () => {
    const instance = { ativo: true, provider: 'meta', waba_id: 'w', access_token: 't', saude_status: 'CONNECTED', saude_quality: 'GREEN' };
    expect(motivoBloqueioTemplate(instance)).toBe(null);
    expect(motivoBloqueioTemplate({ ...instance, saude_quality: 'RED' })).toBe('qualidade red');
    expect(motivoBloqueioTemplate({ ...instance, saude_quality: 'YELLOW' })).toBe('qualidade yellow');
    expect(motivoBloqueioTemplate({ ...instance, saude_ban_info: { blocked: true } })).toBe('banimento informado pela Meta');
  });
});