## Objetivo

Na tela de resultado da consulta de CPF (`src/pages/ConsultaResultado.tsx`), o cliente precisa ver logo de cara **as duas propostas (à vista e parcelada)** antes de qualquer clique. Só depois de escolher uma das opções o botão principal de "Negociar via WhatsApp" fica ativo. Também será adicionado um botão secundário de "Fazer contraproposta".

## Mudanças na tela principal do resultado

Hoje, o card inferior mostra apenas o valor à vista e um botão "NEGOCIAR AGORA COM DESCONTO", que abre um fluxo completo de montagem de proposta (com data, parcelas, entrada etc.) só depois do clique.

Novo comportamento:

1. **Substituir o bloco "Mas você pode pagar à vista por apenas…"** por dois cards de escolha lado a lado (reutilizando o `DiscountTierSelector` já existente, que já mostra:
   - À vista: valor com desconto + % OFF + economia
   - 2 a 24x: valor com desconto + % OFF + economia
   
   O componente já trata bloqueios por valor mínimo de parcela, então é só posicioná-lo no card principal.

2. **CTA principal desabilitado até a escolha:**
   - Sem seleção → botão "Escolha uma opção acima" (cinza, disabled).
   - Com "À vista" selecionado → "QUITAR À VISTA NO WHATSAPP" (verde, habilitado).
   - Com "Parcelado" selecionado → "PARCELAR NO WHATSAPP" (verde, habilitado).
   - Ao clicar, abre o WhatsApp direto com a mensagem já usada hoje (nome, CPF, contratos, valor com desconto, modalidade escolhida). Pula todo o fluxo antigo de "monte sua proposta / confirmar proposta".

3. **Botão "Fazer contraproposta":**
   - Aparece logo abaixo do CTA principal, sempre visível (independe da escolha).
   - Estilo secundário/outline para não competir com o verde principal.
   - Link para: `https://wa.me/${PHONE}?text=Olá, quero negociar meu débito e tenho uma contraproposta.` (texto exato pedido, sem variáveis adicionais).

4. **Se já existe acordo ativo:** manter o comportamento atual (botão cinza "NEGOCIAÇÃO EM ANDAMENTO"), sem seletor nem contraproposta.

## Escopo técnico (para referência)

Arquivo único: `src/pages/ConsultaResultado.tsx`.

- Adicionar estado local `faixaEscolhida: 'avista' | 'parcelado' | undefined` no card principal (independente do estado `negociacao` usado no fluxo antigo).
- Renderizar `<DiscountTierSelector selected={faixaEscolhida} onSelect={setFaixaEscolhida} valorTotal={valorTotal} diasAtraso={diasAtraso} />` dentro do card de valor total.
- Botão principal: disabled quando `!faixaEscolhida`; onClick monta a mensagem no mesmo padrão do fluxo atual (usando `getDesconto`, `formatCurrency`, contratos, nome, CPF) e faz `window.open(wa.me/...)`.
- Botão contraproposta: link `wa.me/${PHONE}` com texto fixo "Olá, quero negociar meu débito e tenho uma contraproposta.".
- Remover (ou manter escondido) o fluxo antigo de "Monte sua proposta / Confirmar proposta" para não duplicar a experiência — não é mais necessário porque a escolha e o envio agora acontecem direto no card principal. Se preferir preservar o código, envolvo em um flag e mantenho off.

Sem mudanças em backend, edge functions, banco ou regras de desconto (`src/lib/descontoPortal.ts` continua sendo a fonte).
