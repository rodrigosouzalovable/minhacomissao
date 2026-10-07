import { describe, expect, test } from 'bun:test';
import { catalogoUtility, situacaoUtility, type UtilityMaster, type TemplateCopy } from '../src/lib/metaUtilityCatalog';
import { modelosParaCopiar } from '../supabase/functions/_shared/meta-template-copy-candidates';

const master: UtilityMaster = { id: 'm1', nome: 'utilidade', idioma: 'pt_BR', criado_por: 'owner',
  categoria: 'UTILITY', reclassificado_marketing: false, corpo: 'Olá {{1}}', cabecalho_tipo: 'TEXT',
  cabecalho_texto: 'Cobrança', rodape: 'Equipe', botoes: [{ type: 'URL', text: 'Detalhes', url: 'https://example.com/{{1}}' }] };
const copy: TemplateCopy = { id: 't1', nome_template: 'utilidade', idioma: 'pt_BR', categoria: 'UTILITY',
  instancia_id: 'i1', status: 'approved', body_text: 'Olá {{1}}', variaveis: {} };
const catalog = (copies: TemplateCopy[], masters: UtilityMaster[], selected: string[] = []) =>
  catalogoUtility(copies, masters, 'owner', ['i1', 'i2'], selected, () => 1);

describe('Utility catalog independent of instance selection', () => {
  test('counts approved accessible instances regardless of selection and deduplicates copies', () => {
    const g = catalog([copy, { ...copy, id: 'duplicate' }, { ...copy, id: 'approved2', instancia_id: 'i2' }, { ...copy, instancia_id: 'hidden' }], [], [])[0];
    expect([...g.todasInstanciasAprovadasIds]).toEqual(['i1', 'i2']);
    expect(g.instanciasAprovadasIds.size).toBe(0);
    expect(catalog([copy, { ...copy, instancia_id: 'i2', status: 'pending' }], [], ['i2'])[0].todasInstanciasAprovadasIds.size).toBe(1);
  });
  test('own absent model is selectable before any instance and has no sending ID', () => {
    const [g] = catalog([], [master]);
    expect(g.key).toBe('utilidade::pt_BR');
    expect(g.mestreId).toBe('m1');
    expect(g.rows).toEqual([]);
    expect(g.sample.id).toBe('');
    expect(g.sample.variaveis?._components).toHaveLength(4);
    expect(g.sample.body_text).toBe('Olá {{1}}');
  });
  test('changing instances retains the same model key', () => {
    expect(catalog([], [master], ['i1'])[0].key).toBe(catalog([], [master], ['i2'])[0].key);
    expect(catalog([], [master], ['i1', 'i2'])[0].instanciasAprovadasIds.size).toBe(0);
  });
  test('deduplicates models and counts selected approved instances only', () => {
    const result = catalog([copy, { ...copy, id: 't2', instancia_id: 'i2', status: 'pending' }], [master], ['i1', 'i2']);
    expect(result).toHaveLength(1);
    expect([...result[0].instanciasAprovadasIds]).toEqual(['i1']);
    expect(situacaoUtility(result[0], 'i2')).toBe('Em análise na Meta');
    expect(catalog([copy], [master], ['i2'])[0].instanciasAprovadasIds.size).toBe(0);
  });
  test('excludes foreign masters, Marketing and reclassified masters', () => {
    expect(catalog([], [{ ...master, criado_por: 'other' }, { ...master, categoria: 'MARKETING' },
      { ...master, reclassificado_marketing: true }])).toEqual([]);
    expect(catalog([{ ...copy, categoria: 'MARKETING' }, { ...copy, instancia_id: 'hidden' }], [])).toEqual([]);
  });
  test('known queue and rejection statuses are distinct from absent', () => {
    const g = catalog([], [master])[0];
    expect(situacaoUtility(g, 'i2', 'PENDENTE')).toBe('Na fila');
    expect(situacaoUtility(g, 'i2', 'ENVIADO')).toBe('Em análise na Meta');
    expect(situacaoUtility(g, 'i2', 'REJECTED')).toBe('Rejeitado');
    expect(situacaoUtility(g, 'i2')).toBe('Ausente');
  });
});

describe('Specific application does not submit existing models', () => {
  test('existing master ID is excluded', () => {
    expect(modelosParaCopiar([master], new Set(['m1']), new Set(), new Set())).toEqual([]);
  });
  test('existing name and language is excluded independently of the master mirror', () => {
    expect(modelosParaCopiar([master], new Set(), new Set(['utilidade|pt_BR']), new Set())).toEqual([]);
  });
  test('already queued models are excluded', () => {
    expect(modelosParaCopiar([master], new Set(), new Set(), new Set(['m1']))).toEqual([]);
  });
  test('only genuinely absent models are returned', () => {
    expect(modelosParaCopiar([master], new Set(), new Set(), new Set()).map(m => m.id)).toEqual(['m1']);
  });
});