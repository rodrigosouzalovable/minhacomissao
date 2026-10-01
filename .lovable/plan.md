# Blacklist automática de números sem WhatsApp

## Objetivo

Quando **Validar agora** confirmar que um número brasileiro não possui WhatsApp, o sistema irá registrá-lo na blacklist e removê-lo da lista atual. Nas próximas planilhas, esses números serão identificados e eliminados automaticamente, antes de qualquer nova validação ou envio.

## Como ficará na aba Envio Meta

1. Ao clicar em **Validar agora**:
   - números com WhatsApp permanecem na lista;
   - números confirmados sem WhatsApp são gravados em lote na blacklist com o motivo **“Sem WhatsApp verificado”**;
   - esses números são removidos automaticamente da lista atual, sem exigir o botão manual **Remover sem WhatsApp**;
   - erros e números inconclusivos não entram na blacklist.
2. Ao importar ou colar uma nova lista:
   - o sistema compara os telefones pelos últimos 8 dígitos com a blacklist;
   - remove imediatamente os números já registrados como sem WhatsApp;
   - mostra um resumo, por exemplo: **“387 removidos: já confirmados sem WhatsApp”**;
   - preserva todas as colunas e a ordem dos contatos restantes.
3. O resumo da validação continuará mostrando quantos têm WhatsApp, quantos foram bloqueados e quantos tiveram erro.

## Regras de segurança

- O bloqueio **Sem WhatsApp verificado** será sempre aplicado, mesmo se a chave **Bloquear Blacklist** estiver desligada.
- A chave atual continuará controlando somente clientes que pediram bloqueio/descadastro.
- Somente respostas definitivas da UAZAPI entrarão nessa categoria; timeout, instância desconectada, formato inválido ou falha de consulta nunca serão tratados como “sem WhatsApp”.
- Se o número já possuir um motivo mais forte, como pedido de bloqueio ou “Não é o cliente”, esse motivo não será sobrescrito.
- O bloqueio também será aplicado no início do envio no servidor, evitando que outro caminho ou uma tela desatualizada envie para esses números.
- Um administrador poderá localizar e reativar o número pela tela Blacklist, caso necessário.

## Detalhes técnicos

- Criar uma operação em lote autenticada para registrar e consultar números sem WhatsApp, normalizados pelo sufixo de 8 dígitos, sem sobrescrever bloqueios existentes.
- Usar motivo próprio no cadastro existente, mantendo compatibilidade com a tela Blacklist e com a exportação.
- Ajustar a importação/mapeamento da planilha em `EnvioMeta` para consultar a blacklist após formar a lista de destinatários e antes de exibi-la.
- Ajustar **Validar agora** para registrar os inválidos confirmados e removê-los da lista em uma única conclusão visível.
- Reforçar `envio-meta-massa-iniciar` para que essa categoria seja obrigatória e independente da chave geral da blacklist.
- Registrar também os números definitivamente confirmados durante a validação que ocorre no envio, para evitar nova consulta em campanhas futuras.

## Validação

- Testar lista mista com número válido, número sem WhatsApp e erro de consulta.
- Reimportar a mesma lista e confirmar que o número sem WhatsApp é removido antes de **Validar agora**.
- Desligar **Bloquear Blacklist** e confirmar que “Sem WhatsApp verificado” continua bloqueado, enquanto as demais categorias seguem a chave atual.
- Confirmar que um erro temporário não é gravado e que um motivo anterior não é sobrescrito.
- Confirmar na tela Blacklist o motivo, a exportação e a reativação administrativa.

Sem novo agendamento, consulta recorrente ou envio automático; o trabalho acontece apenas ao importar, validar ou iniciar uma campanha.
