# Respostas rápidas e figurinhas no Inbox Meta Oficial

## Diagnóstico confirmado
- O sistema já possui mensagens rápidas separadas por usuário, com cadastro, edição e exclusão; atualmente elas aparecem apenas como atalhos acima da barra e sua janela de gerenciamento não está ligada ao novo botão solicitado.
- O recebimento oficial já baixa e armazena a imagem das figurinhas. Porém, elas são registradas como texto (`[sticker]`), enquanto a conversa só renderiza imagens quando o tipo é imagem; por isso a figurinha não aparece.
- Emojis enviados como mensagem de texto já fazem parte do texto recebido. As reações a mensagens, porém, chegam em formato próprio e ainda não têm apresentação dedicada.

## Alterações
1. Adicionar um botão com ícone de raio imediatamente à esquerda do clipe, com identificação acessível de **Respostas rápidas**.
2. Ao clicar no raio, abrir a janela existente para cadastrar, editar e excluir as mensagens rápidas do usuário conectado.
3. Integrar as mensagens rápidas à barra de digitação:
   - ao digitar `/`, abrir uma lista com todas as mensagens rápidas do usuário;
   - permitir continuar digitando para filtrar por título ou conteúdo;
   - permitir navegar com mouse ou teclado;
   - ao escolher uma opção, substituir o comando digitado pelo conteúdo no campo, sem enviar automaticamente, permitindo revisão antes do envio;
   - fechar a lista ao apagar `/`, pressionar Escape, selecionar uma opção ou trocar de conversa.
4. Preservar a regra da janela de 24 horas e o prefixo do atendente no momento do envio.
5. Corrigir novas figurinhas recebidas para serem identificadas como figurinha, mantendo download e armazenamento já existentes.
6. Exibir figurinhas no tamanho adequado dentro da conversa, com transparência e opção de ampliar, sem mostrar o texto técnico `[sticker]`.
7. Tratar também registros antigos que já possuem imagem salva e texto `[sticker]`, para que apareçam sem precisar reenviar.
8. Exibir emojis normais no texto como hoje e interpretar reações recebidas como emoji, em vez do marcador técnico `[reaction]`.

## Validação
- Criar, editar e excluir uma resposta pelo botão de raio e confirmar o isolamento entre usuários.
- Digitar `/`, filtrar, navegar, escolher e revisar uma resposta antes de enviar.
- Confirmar funcionamento em desktop e celular, sem sobreposição com clipe, microfone, campo e botão de envio.
- Receber uma figurinha nova e confirmar sua exibição na conversa em tempo real.
- Abrir uma conversa com figurinha antiga já armazenada e confirmar sua exibição.
- Confirmar que mensagens contendo emojis continuam aparecendo corretamente e que reações não surgem mais como `[reaction]`.

## Detalhes técnicos
A interface usará o cadastro existente de mensagens rápidas, sem nova tabela ou consulta periódica. A correção das figurinhas será feita no recebimento oficial e na apresentação compartilhada das mensagens; o recebimento atualizado será publicado após os testes.
