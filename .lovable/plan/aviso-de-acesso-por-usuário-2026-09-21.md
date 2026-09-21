# Aviso de acesso por usuário

## Objetivo
Adicionar, dentro das permissões de cada usuário, um controle **“Notificar quando acessar o sistema”**. Quando ativado, cada abertura ou recarga autenticada do sistema por esse usuário enviará um aviso ao WhatsApp pessoal do administrador.

## Implementação
1. Adicionar uma permissão individual, desativada por padrão, para controlar quais usuários geram o aviso.
2. Exibir um botão de ativar/desativar no formulário **Editar Permissões** de cada usuário e salvá-lo junto às demais permissões.
3. Criar uma função protegida que confirme a identidade autenticada, consulte a permissão e registre o acesso sem aceitar identidade informada pelo navegador.
4. Enfileirar o aviso na estrutura existente de notificações pessoais UAZAPI, preservando o rodízio e o intervalo aleatório de 30–60 segundos entre mensagens.
5. Acionar a função uma vez a cada abertura ou recarga autenticada. Não adicionar polling, cron ou canal em tempo real.
6. Usar uma chave única por evento para impedir duplicação acidental do mesmo aviso, sem bloquear acessos posteriores.

## Conteúdo do aviso
O WhatsApp informará o nome do usuário e o horário do acesso no fuso de Brasília.

## Segurança e validação
- O usuário não poderá ativar sua própria monitoração nem gerar aviso em nome de outra pessoa.
- A nova permissão continuará administrável apenas por administradores.
- Validar controle ligado/desligado, login e recarga, fila com atraso e ausência de avisos para usuários não selecionados.

## Impacto de custo
Baixo e proporcional aos acessos monitorados: uma verificação e, quando habilitado, uma mensagem enfileirada por abertura ou recarga autenticada. Não haverá consultas periódicas.
