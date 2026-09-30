# Corrigir a atualização da taxa de resposta

## Diagnóstico confirmado

A campanha **CNAO 9** continua rodando normalmente. A última apuração válida foi preservada (173 envios apurados, 35 respostas e taxa de 17,34%), enquanto novos envios continuaram acontecendo.

Ao clicar em **Atualizar**, o sistema recalcula respostas e acordos cruzando os telefones da campanha com o histórico de mensagens. Hoje esse cálculo lê e ordena dezenas de milhares de mensagens recebidas porque a comparação do telefone não usa o mesmo formato dos índices existentes. Em momentos de maior carga, a consulta pode ultrapassar o limite do servidor; a tela então mostra o aviso e mantém os números anteriores, em vez de apagá-los.

## Alterações

1. **Otimizar o cruzamento das respostas**
   - Usar a função padronizada de sufixo dos 8 dígitos na apuração.
   - Criar ou ajustar um índice específico para mensagens recebidas por sufixo e data.
   - Restringir a leitura à janela de datas realmente necessária para a campanha.

2. **Reduzir o trabalho do cálculo**
   - Separar a apuração de respostas da apuração de acordos, evitando combinações caras e repetidas.
   - Manter a regra atual: resposta recebida em até 72 horas após o envio e pessoa contada uma vez na taxa.
   - Manter acordos vinculados por telefone ou CPF em até 15 dias.

3. **Manter a atualização segura na tela**
   - Continuar preservando o último resultado válido caso haja falha.
   - Mostrar carregamento enquanto a apuração estiver em andamento e o horário do resultado concluído.
   - Evitar cliques simultâneos no botão **Atualizar**.

## Validação

- Medir o cálculo da CNAO 9 antes e depois da otimização.
- Confirmar os totais de mensagens respondidas, pessoas que responderam e taxa de resposta.
- Testar uma campanha em andamento e uma concluída.
- Confirmar que uma falha temporária nunca substitui números válidos por zero.

## Custo

Não será criado agendamento, atualização automática ou consulta recorrente. O novo índice terá apenas custo inicial de criação e pequeno uso adicional de armazenamento; em troca, reduzirá significativamente o trabalho e o tempo de cada clique em **Atualizar**.
