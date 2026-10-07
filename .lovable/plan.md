# Importação completa e contagem de envios no Envio Meta

## O que foi confirmado

- A imagem já mostra **3 destinatários**: **1 estimado cobrado + 2 estimados grátis**. O número “Cobrados” não representa o total de disparos.
- Há mensagens recebidas nas últimas 24 horas para dois telefones da imagem. Isso explica a possibilidade de gratuidade para Utility, mas a imagem não informa quais instâncias foram selecionadas; portanto, a gratuidade exata dessa campanha ainda precisa ser conferida.
- Hoje, a estimativa considera grátis um telefone com entrada recente em **qualquer** instância selecionada, sem garantir que essa será a instância remetente, e aplica a mesma dedução a categorias diferentes.
- A importação considera a primeira linha cabeçalho quando a primeira célula tem menos de oito dígitos. Assim, uma planilha sem cabeçalho que começa pelo nome pode perder o primeiro cliente.

## Alterações

### 1. Contagem e estimativa

- Destacar **Total previsto de envios**, separado de **Estimados cobrados** e **Estimados grátis**, mantendo todos os destinatários válidos na lista, independentemente da cobrança.
- Conferir a gratuidade por categoria e pela janela de atendimento da instância remetente, evitando considerar que uma resposta em outro número torna o envio gratuito.
- Quando o remetente ainda puder mudar pela distribuição entre instâncias, usar uma estimativa conservadora, sem prometer gratuidade não confirmada.
- Unificar o cálculo mostrado na página e o usado na confirmação de custo, incluindo tratamento de falhas e resultados antigos durante a atualização.
- Não transformar os três envios em três cobranças artificialmente: preservar a gratuidade legítima concedida pela Meta.

### 2. Primeira linha sem cabeçalho

- Detectar o cabeçalho pelo conjunto de colunas e seus rótulos, não apenas pela primeira célula.
- Incluir a primeira linha quando contiver dados, mesmo com Nome antes de Telefone, colunas vazias ou somente um cliente.
- Adicionar a opção **A primeira linha é cabeçalho** na confirmação da importação, permitindo corrigir casos ambíguos antes de concluir.
- Usar a mesma escolha na prévia, nas variáveis e na lista final; preservar as regras atuais de duplicidade, blacklist, CPF e credor.
- Aplicar a correção também à colagem tabulada que utiliza o mesmo mapeamento, sem alterar a digitação manual.

## Detalhes técnicos

- Ajustar `MapearColunasImportDialog.tsx` e extrair a detecção de cabeçalho para uma função testável.
- Centralizar a lógica de estimativa usada por `useCustoEstimadoEnvio` e `calcularCustoEstimado`; ajustar `CustoEstimadoEnvio.tsx` e os parâmetros em `EnvioMeta.tsx` conforme a distribuição real.
- Reutilizar consultas existentes e leitura em lotes, sem novo agendamento, polling, canal em tempo real ou aumento deliberado da frequência de consultas.
- Não alterar preços, envio de mensagens ou regras de segurança da campanha.

## Validação

- Testar três destinatários: o total continua três, incluindo os que têm gratuidade confirmada.
- Testar Utility com e sem janela aberta, janela em outro remetente, Marketing e falha de consulta.
- Testar planilhas com cabeçalho, sem cabeçalho começando por telefone ou nome, com primeira célula vazia e com uma única linha.
- Confirmar na tela que o primeiro cliente aparece na prévia e na lista final, e que total e divisão de custo permanecem coerentes.
- Executar testes e conferir erros da aplicação, **sem disparar mensagens reais**.