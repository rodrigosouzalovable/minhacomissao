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
