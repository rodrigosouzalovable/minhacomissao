# Qualidade baixa: sai da campanha em andamento, mas pode ser escolhida com aviso

## Entendimento correto

1. **Durante a campanha:** se um número cair para YELLOW ou RED, ele sai do disparo imediatamente e não envia mais — **sempre**, sem exceção.
2. **Antes de começar:** você (ou um usuário com a tag Parceiro Meta) pode escolher à mão um número que já está YELLOW ou RED e a campanha aceita, desde que confirme o aviso de risco.
3. **"Selecionar todas":** continua marcando somente números sem nenhum problema (conectados, nome aprovado, conta com saldo e qualidade verde).

Hoje o comportamento está errado no ponto 1: uma campanha iniciada manualmente com número não-verde mantém esse número até o fim (foi o que gerou os dois avisos "Qualidade baixa, mas seguindo no envio" que você recebeu).

## O que vou mudar

### Envio em andamento volta a ser rigoroso
- Remover a exceção que mantinha YELLOW/RED no rodízio. Qualquer queda de qualidade durante o disparo tira o número na hora, com o aviso atual no WhatsApp ("saiu da campanha por queda de qualidade").
- O aviso "Qualidade baixa, mas seguindo no envio" deixa de existir.
- A recolocação automática continua exigindo qualidade verde e número disponível na Meta.
- O ganho de velocidade obtido hoje (checagem de saúde em paralelo, sem travar o envio) é mantido — sem relação com essa regra.

### Escolha manual com aviso e confirmação
- No campo **Instâncias** da aba Envio Meta, cada número YELLOW/RED/sem leitura ganha um selo de aviso "⚠️ Risco" ao lado da qualidade, com explicação ao passar o mouse.
- Ao marcar manualmente um desses números, aparece um resumo de aviso acima da lista: "X número(s) com qualidade baixa selecionados — risco de restrição ou banimento pela Meta."
- Ao clicar em iniciar o disparo, antes da confirmação de custo, aparece uma tela de confirmação listando os números arriscados e sua qualidade, exigindo que você marque "Estou ciente do risco e quero enviar por estes números". Sem isso, a campanha não inicia.
- Cancelar volta para a tela sem iniciar nada.

### Marcação da campanha
- A campanha registra que houve escolha consciente de números de qualidade baixa (só para histórico e para o painel de instâncias exibir "iniciada com números de risco"). Isso **não** impede mais a saída por queda de qualidade.

## Sem mudanças em

- Bloqueios reais da Meta (conta bloqueada, cobrança pendente, número banido, nome reprovado, cota do número) continuam retirando o número.
- "Selecionar todas" segue apenas verde.
- Aquecimento/recuperação seguem como estão.

## Detalhes técnicos

- `supabase/functions/envio-meta-massa-tick/index.ts`: remover o bloco `if (job.permitir_qualidade_baixa === true)` de `removerInstanciasComQuedaQualidade` (linhas ~296-322) e o aviso `envio_meta_qualidade_mantida`; em `processarItem` (linha ~428) voltar a exigir `q === 'GREEN'` independentemente da flag; em `reabilitarInstanciasRecuperadas` exigir GREEN sempre; manter `ignorar_pausa_qualidade` apenas para `modo_rajada`.
- `supabase/functions/envio-meta-massa-iniciar/index.ts`: manter `permitir_qualidade_baixa` gravado apenas como registro da escolha manual (não altera comportamento do tick); continuar aceitando os IDs YELLOW/RED enviados pelo cliente.
- `src/pages/EnvioMeta.tsx`: novo selo "Risco" na linha da instância; contador/aviso acima da lista; novo `AlertDialog` de confirmação com checkbox, disparado no início de `iniciarDisparo` antes de `pedirConfirmacaoCusto`; `instanciaSemProblema` e o "Selecionar todas (GREEN)" ficam intactos.
- `src/components/meta/CampanhaInstanciasPanel.tsx`: rótulo "Iniciada com números de risco" quando o job tem a flag.
- Sem migração, sem novos crons, polling ou consultas recorrentes — sem impacto de custo no Lovable Cloud.
- Atualizar a memória `campanha-qualidade-baixa-manual` para a regra correta.
