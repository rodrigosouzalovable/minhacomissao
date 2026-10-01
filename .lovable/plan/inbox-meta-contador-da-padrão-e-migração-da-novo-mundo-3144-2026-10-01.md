# Inbox Meta: contador da Padrão e migração da Novo Mundo 3144 para UAZAPI

## Situação confirmada

- O número exibido ao lado de **Inbox Meta Oficial** não representa todas as conversas abertas: ele conta as conversas **não lidas e não arquivadas** de todas as caixas.
- Na consulta realizada, havia **3.636 não lidas no total**, sendo **1.445 na caixa Padrão** e **2.191 nas demais caixas**. O valor pode variar enquanto novas mensagens chegam.
- A lista interna do Inbox já filtra corretamente pela caixa selecionada; o ajuste necessário é no contador do menu.
- A **Novo Mundo 3144** oficial está ativa na caixa Padrão e possui **1.766 conversas**, das quais 1.765 já estão na Padrão.
- Ao conectar um número na UAZAPI, o sistema cria hoje um espelho no Inbox e o coloca inicialmente em **AQUECIMENTO**. Portanto, a 3144 precisará de uma migração específica para a Padrão.

## Alterações

### 1. Contador exclusivo da caixa Padrão

- Alterar o contador ao lado de **Inbox Meta Oficial** para considerar somente conversas:
  - da caixa Padrão;
  - não arquivadas;
  - com mensagens não lidas;
  - pertencentes a instâncias ativas e acessíveis ao usuário.
- Mensagens não lidas de AQUECIMENTO, AMARAL NM, CERTIFICADO e demais caixas deixarão de aumentar esse número.
- Manter a atualização automática já existente, sem criar nova consulta recorrente ou novo canal em tempo real.

### 2. Preparar a Novo Mundo 3144 para a UAZAPI

- Após o número correto ser conectado na aba UAZAPI, vincular explicitamente essa nova conexão à **caixa Padrão**.
- Não identificar a instância apenas pelo final `3144`, pois já existe outro número UAZAPI com esse mesmo final. O vínculo será feito pelo registro exato criado na conexão.
- Ajustar a sincronização para preservar permanentemente a caixa Padrão dessa instância; futuras atualizações de nome, telefone ou estado não poderão devolvê-la para AQUECIMENTO.
- Desativar o registro antigo da API Oficial somente depois que a nova conexão UAZAPI estiver confirmada e recebendo mensagens, evitando período sem atendimento e evitando duplicidade.

### 3. Manter todo o histórico junto

- Em uma operação atômica, transferir para o novo espelho UAZAPI:
  - as 1.766 conversas existentes da instância oficial;
  - todo o histórico de mensagens associado;
  - etiquetas, qualificações, responsável, não lidas, fixadas, arquivadas e demais vínculos da conversa.
- Preservar os mesmos cards e identificadores das conversas sempre que possível, para não criar uma segunda conversa para o mesmo cliente.
- Normalizar os telefones e conferir o sufixo de 8 dígitos para impedir duplicidade caso alguma mensagem chegue durante a troca.
- A única conversa atualmente fora da Padrão será revisada e movida junto, salvo se houver uma regra explícita de negócio que exija mantê-la na caixa atual.

### 4. Entrada e resposta depois da migração

- Novas mensagens recebidas pela UAZAPI serão espelhadas diretamente na caixa Padrão.
- Os atendentes continuarão respondendo pelo próprio Inbox Meta Oficial; texto, áudio e arquivos sairão pela nova conexão UAZAPI.
- O IAGO continuará seguindo a regra atual: atende somente a caixa Padrão e escala para a fila humana quando necessário.
- Grupos, status e listas de transmissão continuarão bloqueados.

## Ordem segura da troca

1. Implantar o contador restrito à Padrão e a regra permanente de vínculo da 3144.
2. Aguardar você conectar o número correto na UAZAPI.
3. Validar que a nova conexão está ativa e identificar seu registro exato.
4. Pausar brevemente a entrada da instância antiga, migrar histórico e vínculos em uma transação e ativar o espelho UAZAPI na Padrão.
5. Fazer uma mensagem controlada de entrada e uma resposta manual para validar os dois sentidos.
6. Só então manter a instância oficial antiga desativada.

## Validação

- Confirmar que o contador do menu coincide com as não lidas da caixa Padrão e ignora todas as outras caixas.
- Confirmar que trocar de caixa dentro do Inbox não altera esse contador global da Padrão.
- Confirmar que a Novo Mundo 3144 aparece entre os números da Padrão como **Não oficial (UAZAPI)**.
- Confirmar que uma conversa antiga abre com todo o histórico e que uma nova mensagem entra no mesmo card.
- Confirmar envio de texto e arquivo pelo atendente, sem usar a conexão Meta antiga.
- Confirmar ausência de mensagens duplicadas e de conversas criadas em AQUECIMENTO.

## Custo e operação

Não será criado cron, polling ou canal em tempo real novo. A solução reutiliza o espelhamento e a atualização já existentes, sem aumento recorrente relevante de custo.
