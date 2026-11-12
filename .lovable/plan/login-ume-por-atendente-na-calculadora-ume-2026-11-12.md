# Login UME por atendente na Calculadora UME

## O que muda para o atendente
- No topo da Calculadora UME aparece um quadro **"Login UME"** com usuário e senha do backoffice UME e o botão **Entrar**.
- Logado: mostra "Conectado como fulano" e o botão **Sair**.
- Sem login ativo, os botões de envio da calculadora ficam bloqueados (enviar proposta, PIX/boleto e "Parcela em atraso"), com o aviso "Faça login na UME para enviar". As consultas e a simulação continuam liberadas.
- O login vale até a UME encerrar a sessão. Quando ela expirar, o quadro volta a pedir a senha.
- Tudo que for gerado ou enviado pela calculadora fica registrado com o login UME de quem enviou.

## Segurança
- A senha nunca fica salva: ela é usada uma vez para entrar na UME.
- O sistema guarda só a sessão da UME, em uma área que o navegador não lê.
- Cada atendente só usa a própria sessão.

## Detalhes técnicos
- Nova tabela `ume_sessoes_usuario` (user_id, ume_username, tokens de acesso e de renovação, validade), com acesso apenas pelo servidor.
- Nova função `ume-login` (entrar/status/sair): faz o login na UME com a senha do atendente, usando o mesmo client da empresa.
- `_shared/ume-api.ts`: aceita o token do atendente, renova pela sessão e falha com `ume_login_expirado` quando ela termina.
- `ume-boleto`, `portal-pix-parcela` (no modo Inbox) e a função da parcela em atraso exigem a sessão ativa de quem chama. O login dele vai para `ume_boleto_log.ume_username`.
- Portal público, cron e IAGO continuam usando a conta da empresa, sem mudança.
- Frontend: componente `UmeLoginBox` na calculadora e bloqueio dos botões de envio.
- Não há polling nem cron novo: o status é consultado ao abrir a calculadora.

## Ponto a confirmar no teste
- Se a UME aceitar o login de atendente só com o client da empresa, funciona direto. Se recusar, aviso o motivo antes de bloquear qualquer envio.
