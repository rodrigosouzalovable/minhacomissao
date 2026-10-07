import { describe, expect, it } from 'bun:test';
import { valoresCadastrais, respostaCadastral, templateCadastralValido, TEMPLATE_CADASTRAL, AGRADECIMENTO_CADASTRAL, REPOSICAO_CADASTRAL } from '../supabase/functions/_shared/recuperacao-cadastral-rules';
describe('recuperação cadastral', () => {
  it('primeira variável tudo bem? e segunda nome empresarial completo', () => expect(valoresCadastrais('Clínica Vida Nova Ltda')).toEqual(['tudo bem?', 'Clínica Vida Nova Ltda']));
  it('não inventa nome para apelido técnico ou ausência', () => { expect(() => valoresCadastrais('user-123')).toThrow(); expect(() => valoresCadastrais('Iphone B1')).toThrow(); expect(() => valoresCadastrais(null)).toThrow(); });
  it('somente modelo Utility solicitado com duas variáveis', () => {
    const tpl = { name: TEMPLATE_CADASTRAL, categoria: 'UTILITY', params: { chaves: ['1', '2'] } };
    expect(templateCadastralValido(tpl)).toBe(true);
    expect(templateCadastralValido({ ...tpl, name: 'outro' })).toBe(false);
    expect(templateCadastralValido({ ...tpl, categoria: 'MARKETING' })).toBe(false);
    expect(templateCadastralValido({ ...tpl, params: { chaves: ['1'] } })).toBe(false);
  });
  it('confirma explicitamente e agradece com texto exato', () => { expect(respostaCadastral('SIM, CONFIRMO.')).toBe('confirmacao'); expect(AGRADECIMENTO_CADASTRAL).toBe('Obrigado pela confirmação'); });
  it('Sair é saída', () => expect(respostaCadastral('SAIR')).toBe('saida'));
  it('Não é negativa', () => expect(respostaCadastral('NÃO')).toBe('negativa'));
  it('outras mensagens não recebem resposta', () => { for (const t of ['Olá', 'Obrigado por entrar em contato, responderemos em breve', 'sim, mas quem é você?', 'não confirmo, sim?', '']) expect(respostaCadastral(t)).toBe('outra'); });
  it('reposição de 100', () => expect(REPOSICAO_CADASTRAL).toBe(100));
});