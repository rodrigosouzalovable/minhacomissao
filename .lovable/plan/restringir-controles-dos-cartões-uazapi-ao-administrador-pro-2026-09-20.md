# Restringir controles dos cartões UAZAPI ao administrador proprietário

## Resultado esperado
- No login administrativo proprietário, manter todos os controles atuais de cada instância UAZAPI.
- Para qualquer outro usuário com acesso à aba WhatsApp, mostrar no cartão somente:
  - nome e número da instância;
  - situação da conexão: conectado, desconectado ou verificando;
  - botão **Editar**.

## Alterações na tela
- Exibir somente para o administrador proprietário:
  - **Notificações pessoais** e o selo **Notificações**;
  - opções **Apenas Lembretes**, **Robô** e **IA Responde**, incluindo seus selos;
  - chave **Ativar/Desativar**;
  - botão **Testar conexão**;
  - botão **Excluir/Remover**;
  - informação técnica do servidor;
  - indicador de proxy;
  - controle de reordenação dos cartões.
- Manter o botão **Editar** disponível aos demais usuários autorizados.
- Não alterar as configurações já salvas nas instâncias; a mudança será apenas de acesso e apresentação.

## Proteções
- Usar a identificação exclusiva já adotada para o administrador proprietário, evitando liberar esses controles a outros administradores.
- Adicionar bloqueios nas ações sensíveis da própria tela para impedir acionamento indireto por usuários não autorizados.
- Preservar o funcionamento atual da edição permitida e das verificações automáticas de conexão.

## Validação
- Conferir com o login proprietário que todos os controles continuam disponíveis.
- Conferir com um usuário comum autorizado que aparecem apenas instância, número, conexão e **Editar**.
- Validar que a tela abre sem erros e que editar uma instância continua funcionando.
