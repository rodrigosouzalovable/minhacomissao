# Liberar QR Code e exportação para usuários autorizados na UAZAPI

## Resultado esperado
- Usuários que tiverem a aba **UAZAPI** marcada em **Usuários > Permissões** continuarão conseguindo entrar nela.
- Esses usuários também verão e poderão usar:
  - **Conectar via QR Code**;
  - **Exportar números (Excel)**.
- O administrador proprietário continuará com todos os controles atuais.
- Usuários sem a permissão da aba continuarão sem acesso.

## Alterações na tela
- Exibir **Exportar números (Excel)** ao administrador proprietário e a qualquer usuário autorizado na aba, quando existirem números disponíveis.
- Exibir **Conectar via QR Code** e todo o fluxo necessário para gerar, atualizar, cancelar e concluir a leitura do QR Code aos usuários autorizados.
- Ajustar o texto da área de instâncias para indicar que esses usuários também podem conectar um WhatsApp.
- Manter exclusivos do administrador proprietário:
  - conexão por código e cadastro manual;
  - ativar todas, verificar conexões e reordenar cartões;
  - ativar/desativar, excluir e testar instâncias;
  - notificações pessoais, Apenas Lembretes, Robô e IA Responde;
  - Números Virtuais, relatórios e webhooks.

## Proteção de acesso
- Validar no serviço de conexão que a solicitação vem de um usuário autenticado.
- Permitir criar e consultar o QR Code somente para o próprio usuário que possui acesso à aba UAZAPI, sem aceitar a identidade informada livremente pela tela.
- Preservar o isolamento atual: a exportação incluirá somente as instâncias que o usuário já pode visualizar.

## Validação
- Testar com o login proprietário: todos os controles permanecem disponíveis.
- Testar com um usuário que tenha a aba UAZAPI marcada: QR Code e exportação aparecem e funcionam; os demais controles administrativos permanecem ocultos.
- Testar com um usuário sem a aba marcada: o acesso continua bloqueado.
- Confirmar compilação sem erros e testar a abertura/cancelamento do fluxo de QR Code sem criar controles extras.
