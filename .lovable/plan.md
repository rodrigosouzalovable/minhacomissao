# Escolher opções de pagamento na mensagem da proposta UME

## O que muda
Na janela "Configurar mensagem da proposta" (botão de engrenagem da Calculadora UME), aparece uma nova seção **"Opções que vão na mensagem"**:

- Um botão liga/desliga **À vista**.
- Uma grade com botões **2x, 3x, 4x … 18x**, cada um liga/desliga.
- Atalhos: **Marcar todas** e **Desmarcar todas**.

Ao montar a mensagem, só entram as opções ligadas:
- À vista desligado: o valor à vista some da mensagem (a linha onde ele aparece é removida, sem deixar "—" solto).
- A lista de parcelas mostra só as quantidades marcadas (ex.: só 3x, 6x e 12x).
- "Maior parcelamento" e "menor parcela" passam a considerar só as marcadas.

## Regras que continuam iguais
- Parcela mínima de R$ 100 e limite de 18x: uma parcela marcada que fique abaixo de R$ 100 continua fora.
- Valores calculados não mudam; só o que é exibido na mensagem.
- A escolha fica salva por usuário, junto com o modelo da mensagem (cada atendente tem a sua). Padrão: tudo ligado, como hoje.
- A pré-visualização da janela mostra o resultado na hora.

## Detalhes técnicos
- `src/lib/umePropostaModelo.ts`: novo tipo `OpcoesProposta { avista: boolean; parcelas: number[] }`; `parcelasOferecidas`, `valoresProposta` e `preencherModelo` recebem as opções (opcional, padrão = todas). Com à vista desligado, remover linhas do texto que contenham `{avista}`.
- `ConfigurarModeloUmeDialog.tsx`: seção de botões (Switch + toggles 2–18) e salvamento junto do modelo atual (mesmo local de armazenamento por usuário já usado).
- `ConsultaUmeDialog.tsx`: passar as opções salvas ao preencher a mensagem.
- Testes em `umePropostaModelo.test.ts`: à vista desligado remove a linha; só 3/6/12 marcados geram exatamente essas 3 linhas; parcela marcada abaixo de R$100 continua fora.
- Sem custo extra de servidor.
