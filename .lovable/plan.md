# Liberar documentos para Bruno e impedir atendimentos sem responsável no IAGO

## Diagnóstico confirmado

- Bruno é administrador das caixas **AMARAL NM, ODRES, ODRES-Confirmação, ODRES-Entradas e ODRES-Vencido**. A regra atual reconhece que ele pode visualizar as conversas dessas caixas, inclusive a conversa de **luis fernando giffhorn** usada no relato.
- O envio atual aceita imagem, áudio, vídeo e PDF. O arquivo é armazenado antes de ser enviado; a autorização depende da instância, telefone/BSUID e acesso à caixa. A permissão foi corrigida recentemente, mas ainda falta validar o fluxo completo autenticado como Bruno e cobrir documentos comuns além de PDF.
- Na conversa da imagem, o IAGO leu o CPF **608.945.863-51**, concluiu que não havia débito localizado, marcou **Aguardando Humano** às 11h16 de 29/09, mas a etiqueta **Atendente: Wallace** só apareceu às 09h35 de 30/09. Portanto, o cliente realmente ficou sem responsável por quase um dia.
- A transferência atual já funciona nas novas escaladas de hoje: 19 conversas da caixa PADRÃO foram escaladas e as 19 receberam atendente. Porém, há conversas anteriores marcadas como aguardando humano sem uma etiqueta de atendente, e alguns caminhos do IAGO ainda conseguem marcar a espera sem executar ou confirmar o rodízio.
- A apresentação mostrada na imagem diz apenas “Sou o Iago”; não informa explicitamente que ele é um assistente virtual.

## Alterações

### 1. Permitir que Bruno envie documentos nas caixas que administra

- Alinhar armazenamento e envio com a mesma permissão usada para abrir e interagir com a conversa.
- Autorizar o administrador da caixa a anexar documentos em qualquer conversa daquela caixa, mesmo quando a instância pertence a outro usuário.
- Manter a proteção por caixa, instância e destinatário: Bruno não ganhará acesso a conversas fora das caixas que administra.
- Aceitar PDF e formatos comuns de documento suportados pelo WhatsApp, com nome e tipo corretos; continuar bloqueando arquivos executáveis ou perigosos.
- Preservar imagem, áudio e vídeo e mostrar uma mensagem clara se o arquivo ultrapassar o limite ou não for aceito.

### 2. Tornar a transferência do IAGO uma operação única e confirmada

- Centralizar “Aguardando Humano” e a escolha do próximo atendente em uma única operação no banco.
- Na caixa PADRÃO, o IAGO só encerrará a própria atuação depois que a etiqueta do próximo atendente tiver sido gravada conforme a fila circular já definida.
- Se não houver atendente apto ou a atribuição falhar, registrar a falha de forma visível e tentar novamente de modo controlado; não deixar apenas a etiqueta genérica sem responsável.
- Aplicar essa transferência nos casos de dúvida, CPF sem débito localizado, acordo já existente, mídia não interpretável, falha técnica e pedido explícito para falar com humano.
- Preservar a ordem da fila e as prioridades existentes, sem compensar quantidade de contatos e sem redistribuir conversas que já têm atendente.

### 3. Garantir resposta e transparência em todas as mensagens da caixa PADRÃO

- Reforçar que cada nova mensagem seja interpretada com o histórico completo da conversa, incluindo mensagens da equipe e do cliente.
- Na primeira resposta do IAGO, informar claramente que ele é um **assistente virtual** e que o cliente pode pedir para falar com uma pessoa.
- Depois que o cliente enviar o CPF, avançar para proposta ou explicação; se a consulta não produzir uma resposta segura, avisar que chamará a equipe e transferir imediatamente.
- Impedir estados silenciosos: se o IAGO não conseguir responder, a conversa deve receber uma mensagem curta de transição e um atendente da fila na mesma execução.
- Respostas manuais de funcionários continuam encerrando a atuação do IAGO naquela conversa conforme as regras atuais.

### 4. Corrigir conversas que já ficaram paradas

- Localizar as conversas da caixa PADRÃO que estão em **Aguardando Humano** sem etiqueta de atendente.
- Encaminhar cada uma para o próximo atendente da fila, sem enviar mensagens retroativas aos clientes e sem alterar conversas que já possuem responsável.
- Registrar quantas conversas foram recuperadas e quais permaneceram pendentes por ausência de atendente apto.

## Validação

- Entrar como Bruno e testar upload de PDF e de um documento comum em uma conversa de cada caixa administrada, armazenando o arquivo e gerando a URL sem enviá-lo ao cliente.
- Confirmar que um usuário sem acesso à caixa continua bloqueado.
- Simular na caixa PADRÃO: CPF com proposta, CPF sem débito, dúvida desconhecida, pedido de humano, mídia não interpretável e falha técnica.
- Em cada escalada, confirmar na mesma execução: mensagem ao cliente, etiqueta **Aguardando Humano**, etiqueta do próximo atendente e avanço correto da fila.
- Confirmar que a primeira apresentação contém “assistente virtual”, sem repetir essa apresentação nas respostas seguintes.
- Não enviar arquivos ou mensagens reais durante os testes.

## Detalhes técnicos

- Ajustar a política/helper de upload do armazenamento para usar a autorização efetiva da conversa e ampliar a validação segura dos tipos de documento.
- Revisar o envio de mídia para validar a sessão do usuário e a permissão sobre a conversa antes de usar a instância.
- Criar uma RPC atômica de escalada do IAGO, unificando a etiqueta de espera e `transferir_iago_para_humano_rodizio`, com retorno explícito de sucesso, ausência de atendente ou erro.
- Substituir os caminhos separados em `iago-atendimento` pela operação única e adicionar testes para CPF e todas as causas de escalada.
- Fazer a correção pontual das conversas paradas por consulta controlada, sem cron, polling ou novo canal em tempo real.
