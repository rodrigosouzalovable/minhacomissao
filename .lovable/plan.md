# Corrigir "API Oficial Meta" travada e áudios "Mídia indisponível" (Thiago)

## O que já foi confirmado
- Os áudios recebidos hoje estão sendo salvos normalmente (todos os áudios das últimas horas têm arquivo guardado). O problema não é a Meta nem o recebimento.
- Desde o ajuste de segurança de ontem, cada atendente só consegue abrir o arquivo se a regra de acesso reconhecer que ele pode ver aquela conversa. Quando essa regra recusa, a tela mostra "Mídia indisponível". Para atendentes que trabalham em caixas compartilhadas (como Thiago na caixa do Gabriel/AMARAL), a regra provavelmente não reconhece o acesso.
- A tela "API Oficial Meta" ainda não tem causa confirmada; a suspeita é que alguma verificação feita ao abrir a tela passou a recusar usuários que não são administradores e a tela fica esperando sem mostrar erro.

## Passos
1. Entrar no sistema como Thiago (com sua aprovação) e reproduzir as duas situações, registrando qual pedido trava ou é recusado.
2. Áudios: ajustar a regra de acesso aos arquivos para aceitar exatamente quem já consegue ver a conversa na tela (dono do número, caixa compartilhada, caixa padrão do parceiro), sem abrir arquivos para quem não vê a conversa.
3. Áudios: se o acesso falhar por outro motivo, mostrar "Tentar novamente" no lugar de "Mídia indisponível" fixo.
4. API Oficial Meta: corrigir a verificação que estiver bloqueando e garantir que, se algo falhar, a tela termine de carregar mostrando um aviso em vez de ficar carregando para sempre.
5. Testar novamente como Thiago: tela abre e o áudio do cliente Okubo toca.

## Detalhes técnicos
- Revisar `can_view_meta_webhook_media` (migração 0240) versus a policy de SELECT de `meta_whatsapp_mensagens`/compartilhamento de caixas; reescrever como security definer reutilizando a mesma lógica de visibilidade da conversa.
- Em `ConfigurarMeta`, localizar a chamada inicial (provável função com guard `admin` ou query sem `finally`) e adicionar timeout/estado de erro.
- Nenhum custo novo (sem cron, polling ou realtime).
