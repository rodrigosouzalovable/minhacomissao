## Objetivo

Ao iniciar uma nova campanha na página `Envio Meta`, o formulário deve ficar imediatamente liberado para iniciar outra. O progresso, status e detalhamento da campanha em andamento devem aparecer **apenas** no botão flutuante "Campanhas" (canto inferior direito).

## Comportamento atual

Depois de clicar em **Disparar**, a página continua "presa" à campanha ativa:
- Mostra a barra `Enviando — 8/154`
- Substitui **Disparar** por **Pausar / Cancelar**
- Renderiza a seção **Detalhamento dos envios** (Enviados / Erros / Pendentes / Exportar CSV)
- Mantém a lista de destinatários e template selecionados

Só é possível começar outra campanha depois que a atual termina (ou cancelando).

## Comportamento desejado

Ao clicar em **Disparar** com sucesso:

1. A campanha some da tela principal e passa a existir apenas no widget flutuante **Campanhas** (que já lista ativas + últimas finalizadas com barra de progresso, pausar/retomar/cancelar e detalhes).
2. A página `Envio Meta` volta ao estado inicial pronto para uma nova campanha:
   - Destinatários limpos (`recipientsText`, `recipientsHeaders`, `varsByTel`, contagens, validação)
   - Nome da campanha limpo
   - Template/instâncias/delays mantidos como padrão sensato (ou também resetados, ver seção Detalhes)
   - Botão **Disparar** volta a aparecer (nada de Pausar/Cancelar inline)
   - Seção "Detalhamento dos envios" **removida** da página
3. O botão flutuante continua sendo a única fonte de verdade para acompanhar e controlar campanhas em andamento — clicar nele abre o detalhamento completo (o `CampanhaDetalheDialog` já existe e já mostra enviados/erros/pendentes/exportar CSV).

## Detalhes técnicos

Arquivo: `src/pages/EnvioMeta.tsx`

1. **Remover renderização inline da campanha ativa**
   - Remover o bloco da barra "Enviando — X/Y … LD …" que hoje aparece logo abaixo dos botões Disparar/Pausar/Cancelar.
   - Remover a seção "Detalhamento dos envios" (Enviados/Aceitos/Erros/Pendentes + Exportar CSV) da página. Essa UI continua acessível via `CampanhaDetalheDialog` no widget flutuante.

2. **Botões de ação**
   - Manter apenas **Disparar** e **Enviar teste (1º número)** na página.
   - Remover **Pausar** e **Cancelar** da página (essas ações já existem por campanha dentro do widget flutuante).

3. **Reset após disparar**
   - Após `iniciarJob(...)` retornar sucesso, chamar um novo `resetFormulario()` que:
     - Zera `recipientsText`, `recipientsHeaders`, `varsByTel`, `nomeCampanha`
     - Zera resultados de validação de WhatsApp
     - Rola para o topo do formulário
     - Emite `toast.success("Campanha iniciada. Acompanhe no botão Campanhas.")`
   - **Manter selecionados**: template principal, instâncias marcadas, `minSec/maxSec`, modo de validação — para facilitar disparar várias campanhas seguidas com a mesma configuração. (Se você preferir zerar tudo, ajusto.)

4. **Contexto de envio (`EnvioMetaSendingContext`)** — nenhuma mudança. Ele já suporta múltiplos jobs em paralelo, o widget já lista todos os `jobsAtivos`, e o backend (`envio-meta-massa-iniciar`) já permite campanhas simultâneas.

5. **Widget flutuante (`CampanhasFlutuante.tsx`)** — sem mudanças. Já mostra ativas, progresso, pausar/retomar/cancelar e abre o `CampanhaDetalheDialog`.

## Fora de escopo

- Nenhuma mudança em edge functions, banco ou lógica de envio.
- Nenhuma mudança em templates, importação de planilha ou tabela de destinatários.
- Widget flutuante e diálogo de detalhe continuam iguais.

## Pergunta rápida antes de implementar

Ao disparar, devo **também** limpar template, instâncias e delays, ou manter esses campos preenchidos para o próximo disparo (recomendação: manter)?