# Botão "Continuar com eles" no aviso de acordos em andamento

## O que muda
Na caixa "Clientes com acordo em andamento" (Envio Meta → Disparar), aparece um novo botão **"Continuar com eles"**, logo abaixo de "Continuar sem eles".

- **Continuar sem eles:** igual a hoje — retira esses clientes e segue para a próxima etapa.
- **Continuar com eles:** mantém a lista completa (inclusive quem tem acordo) e segue automaticamente para a próxima etapa do disparo, sem fechar o processo.
- Baixar planilha e Cancelar continuam iguais.

Nenhuma outra verificação (qualidade dos números, duplicados, blacklist, limites) é pulada — só a retirada por acordo em andamento.

## Detalhes técnicos
- `src/pages/EnvioMeta.tsx`: adicionar `pularFiltroAcordoRef`. O novo botão marca o ref, fecha o diálogo e chama `enviar()`; em `enviarInterno`, o bloco de varredura de acordos é ignorado quando o ref está ativo (e o ref é zerado logo em seguida, valendo só para esse disparo).
- Botão com mesmo estilo/largura centralizada (`w-full sm:w-72`, variante `secondary`).
