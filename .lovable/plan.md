## Objetivo

Quando o cliente escolher **"2 a 24x"** (parcelado) no card de propostas, reabrir o fluxo detalhado de montagem que existia antes (entrada opcional, número de parcelas, data do primeiro pagamento e resumo), sem afetar a experiência do "À vista", que continua indo direto para o WhatsApp após a seleção.

## Comportamento por opção

**Selecionou "À vista":**
- Mostra o botão verde "QUITAR À VISTA NO WHATSAPP" (habilitado imediatamente).
- Botão "FAZER CONTRAPROPOSTA" segue visível abaixo.
- Ao clicar, abre WhatsApp com a mensagem à vista (mesma de agora).

**Selecionou "2 a 24x":**
- Abre logo abaixo do seletor um painel com os campos que existiam antes:
  - Card verde com "De R$ X por R$ Y" e a economia/percentual.
  - Campo **Valor de entrada (opcional)**.
  - Campo **Número de parcelas** (respeitando faixa da modalidade e valor mínimo de R$90 por parcela).
  - Campo **Data do primeiro pagamento** (calendário).
  - **Resumo da negociação** quando entrada + data estão válidas.
- Botão principal só habilita quando a proposta parcelada está válida (`isNegociacaoValida`).
- Rótulo do botão principal muda para **"ENVIAR PROPOSTA PELO WHATSAPP"**; ao clicar, abre WhatsApp com a mensagem parcelada (usando `gerarWhatsappLink`, mesma mensagem detalhada de antes).
- Botão "FAZER CONTRAPROPOSTA" continua visível.

## Escopo técnico (referência)

Arquivo único: `src/pages/ConsultaResultado.tsx`.

- Reaproveitar helpers já existentes no arquivo: `negociacao` state, `updateNegociacao`, `getValorComDesconto`, `getValorParcela`, `getMaxParcelas`, `isNegociacaoValida`, `handleEntradaChange`, `gerarWhatsappLink`.
- Ao selecionar uma faixa no `DiscountTierSelector`:
  - `avista` → apenas `setFaixaEscolhida('avista')`; se `negociacao` estiver aberta, fecha (reseta).
  - `parcelado` → `setFaixaEscolhida('parcelado')` **e** inicializa `negociacao` com `{ negociando: true, confirmado: false, descontoFaixa: 'parcelado', parcelas: 2, entrada: 0, dataPrimeiroPagamento: undefined }`.
- Renderizar o painel de parcelamento (entrada / parcelas / data / resumo) **inline abaixo do seletor**, apenas quando `faixaEscolhida === 'parcelado'` e `negociacao` existe.
- Botão principal:
  - Se `faixaEscolhida === 'avista'` → habilitado, link direto (comportamento atual).
  - Se `faixaEscolhida === 'parcelado'` → habilitado somente se `isNegociacaoValida(negociacao)`; link vem de `gerarWhatsappLink(negociacao)`.
  - Sem seleção → disabled "ESCOLHA UMA OPÇÃO ACIMA".
- Botão "FAZER CONTRAPROPOSTA" mantém texto fixo já definido.

Sem mudanças em backend, edge functions, banco ou regras de desconto.
