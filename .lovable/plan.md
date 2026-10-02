# Acelerar a calculadora UME dentro da conversa

## Diagnóstico confirmado

- A calculadora chamada de “OMIE” no relato aparece no sistema como **Consulta UME — calculadora de desconto**.
- Ao abrir a janela com um CPF já identificado, a consulta começa automaticamente.
- O sistema consulta primeiro a autenticação e a configuração, depois procura o CPF no cache. Quando o cache venceu, aguarda o relatório externo da UME retornar os oito blocos usados pela tela e, em seguida, ainda espera a gravação do novo cache antes de responder.
- O cache possui 16.179 CPFs, mas neste momento somente 24 foram atualizados nas últimas 12 horas. Portanto, a maior parte dos CPFs antigos precisa fazer novamente a consulta externa.
- A chamada externa não possui limite explícito de espera nem registra quanto tempo foi gasto em cada etapa. Os registros atuais não permitem afirmar se a lentidão recente está no relatório externo, na inicialização da função ou na gravação do cache.

## Correção

1. **Medir o tempo real de cada etapa**
   - Registrar separadamente: validação do usuário, leitura da configuração, leitura do cache, consulta ao relatório UME, interpretação da resposta e atualização do cache.
   - Retornar no resultado apenas informações seguras de origem e duração total para facilitar futuras verificações.

2. **Encurtar o caminho das consultas já conhecidas**
   - Após validar o usuário, buscar configuração e cache em paralelo.
   - Em cache válido, devolver os dados imediatamente, sem qualquer chamada ao relatório externo.
   - Em consulta nova, não manter a janela esperando operações secundárias depois que os valores já estiverem prontos.

3. **Evitar espera indefinida e cliques duplicados**
   - Aplicar um limite de tempo controlado à consulta externa e mostrar uma mensagem clara com opção de tentar novamente.
   - Reutilizar a mesma consulta quando o mesmo CPF for solicitado simultaneamente, evitando trabalho duplicado no servidor.
   - Manter o botão desativado durante a busca, como já acontece hoje.

4. **Reduzir o trabalho solicitado ao relatório UME**
   - Consultar primeiro os dados do cliente, totais e a tabela realmente selecionada/configurada.
   - Carregar as tabelas alternativas somente quando forem necessárias, sem alterar os valores ou a regra “Sem Juros + 10%”.
   - Preservar o cache de 12 horas e o botão de atualização manual para não exibir valores antigos como se fossem atuais.

5. **Validar antes de liberar**
   - Comparar o tempo de CPF com cache, CPF sem cache e atualização forçada.
   - Testar abertura automática pela conversa, pesquisa manual, troca entre as três tabelas, CPF inexistente, demora externa e nova tentativa.
   - Confirmar que IAGO e consulta em lote continuam recebendo os mesmos dados e cálculos.

## Detalhes técnicos

- Alterações concentradas na janela da calculadora e no motor compartilhado da consulta UME.
- Sem cron, polling, canal em tempo real ou nova tabela.
- O objetivo é reduzir chamadas e tempo de espera, sem aumentar o custo recorrente da Lovable Cloud.
