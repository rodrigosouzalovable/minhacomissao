# Acesso exclusivo aos controles avançados do WhatsApp

## Objetivo
Deixar exclusivamente para o login administrativo `rodrigo.rs2013@gmail.com`:

- a seção **Números Virtuais (SMS)**;
- os campos de **Relatório Diário WhatsApp**;
- a ação **Reconfigurar Webhooks**;
- as informações de **Webhook do Chatbot IA**.

Os demais administradores e usuários continuarão usando normalmente as outras funções da tela WhatsApp/UAZAPI.

## Implementação

1. **Identificar o proprietário com segurança**
   - Usar o identificador permanente da conta já confirmada, junto da validação do perfil administrativo.
   - Não depender apenas do e-mail exibido na tela.

2. **Ocultar os quatro blocos para qualquer outra conta**
   - Aplicar uma única regra de “administrador proprietário” na tela WhatsApp/UAZAPI.
   - Evitar que os dados desses blocos sejam carregados quando outra conta acessar a página.

3. **Proteger Números Virtuais também no servidor e no banco**
   - Restringir compras, consultas, cancelamentos e configurações de números virtuais ao seu login.
   - Ajustar as permissões dos registros de números virtuais para impedir acesso direto por outros administradores.

4. **Proteger o Relatório Diário WhatsApp também no banco**
   - Restringir leitura e alteração da configuração ao seu login.
   - Manter o envio automático existente funcionando normalmente pelo serviço interno.

5. **Proteger a reconfiguração global de webhooks no servidor**
   - Exigir sessão válida e confirmar que a chamada parte do seu login antes de reconfigurar todas as instâncias.
   - Manter as demais ações normais de conexão das instâncias sem mudança.

6. **Preservar o recebimento do Chatbot IA**
   - Ocultar URL e instruções de configuração para outras contas.
   - Não bloquear o webhook externo usado pela UAZAPI, pois isso interromperia as respostas automáticas.

7. **Validar os dois cenários de acesso**
   - Confirmar que sua conta visualiza e utiliza os quatro blocos.
   - Confirmar que outro administrador não visualiza os blocos e recebe bloqueio ao tentar acessar diretamente as ações ou dados protegidos.

## Detalhes técnicos

- A regra exclusiva será baseada no UUID confirmado da conta e validará também o papel `admin`.
- As políticas atuais de Números Virtuais e Relatório Diário permitem todos os administradores; serão substituídas por políticas exclusivas para essa conta.
- A ação global de reconfiguração de webhooks atualmente precisa de proteção no servidor; ela será validada sem alterar os webhooks públicos que recebem eventos do WhatsApp.
- Não serão criadas rotinas recorrentes, consultas repetitivas ou novos custos operacionais.
