import { describe, it, expect } from "vitest";
import { preencherModelo, detectarCamposLocal, type DadosProposta } from './umePropostaModelo';

const d: DadosProposta = {
  nome: 'Larissa Souza', cpf: '057.194.283-05', diasAtraso: 179, fase: 'Fase 006',
  totalSemJuros: 4713, totalComJuros: 10461, totalProposta: 4713, avista: 4713,
  parcelas: [{ parcelas: 1, valorParcela: 4713 }, { parcelas: 12, valorParcela: 432.03 }, { parcelas: 60, valorParcela: 90 }],
  tabela: 'Sem Juros + 10%',
};

describe('modelo de proposta UME', () => {
  it('preenche os campos e esconde parcelas abaixo de R$ 100', () => {
    const t = preencherModelo('Oi {primeiro_nome}\n{parcelas_lista}\nAté {maior_parcelamento}', d);
    expect(t).toContain('Oi Larissa');
    expect(t).toContain('12x de R$');
    expect(t).not.toContain('60x');
    expect(t).toContain('Até 12x de');
  });
  it('mantém campos desconhecidos como estão', () => {
    expect(preencherModelo('{xpto}', d)).toBe('{xpto}');
  });
  it('detecta nome e valores do texto colado', () => {
    const colado = preencherModelo('Oi Larissa, à vista {avista}', d);
    expect(detectarCamposLocal(colado, d)).toBe('Oi {primeiro_nome}, à vista {avista}');
  });
});

import { preencherModelo as pm2, filtrarTextoPadrao as ftp } from './umePropostaModelo';
describe('opções habilitadas na proposta', () => {
  const d: any = { nome: 'Ana Souza', cpf: '1', diasAtraso: 1, fase: '', totalSemJuros: 1, totalComJuros: 1, totalProposta: 1, avista: 900, tabela: 't',
    parcelas: [2,3,6,12,18].map((n) => ({ parcelas: n, valorParcela: n === 18 ? 50 : 1800 / n })) };
  it('à vista desligado remove a linha', () => {
    expect(pm2('Oi\nÀ vista {avista}\nfim', d, { avista: false, parcelas: [3] })).toBe('Oi\nfim');
  });
  it('só 3, 6 e 12 marcados', () => {
    expect(pm2('{parcelas_lista}', d, { avista: true, parcelas: [3, 6, 12] }).split('\n').map((l) => l.match(/(\d+)x/)![1])).toEqual(['3', '6', '12']);
  });
  it('parcela marcada abaixo de R$100 continua fora', () => {
    expect(pm2('{parcelas_lista}', d, { avista: true, parcelas: [18] })).toBe('');
  });
  it('texto padrão filtra linhas', () => {
    expect(ftp('À vista: R$ 900\n• 2x de R$ 900\n• 3x de R$ 600', { avista: false, parcelas: [3] })).toBe('• 3x de R$ 600');
  });
});

import { preencherModelo as pm2 } from './umePropostaModelo';
it('maior_parcelamento lista exatamente 12x e 15x marcadas', () => {
  const d: any = { nome: 'Ana', cpf: '', diasAtraso: 1, fase: '', totalSemJuros: 3000, totalComJuros: 3000, totalProposta: 3000, avista: 1000, tabela: 'T',
    parcelas: [12, 15, 17].map((n) => ({ parcelas: n, valorParcela: 200 })) };
  const out = pm2('{maior_parcelamento}', d, { avista: false, parcelas: [12, 15] });
  expect(out).toContain('12x');
  expect(out).toContain('15x');
  expect(out).not.toContain('17x');
});
