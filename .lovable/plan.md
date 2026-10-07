# Trocar a imagem somente na campanha do Envio Meta

## Objetivo

Permitir escolher outra imagem diretamente em **Envio Meta → Templates HSM**, após selecionar o template, sem acessar a API Oficial Meta. Conforme sua escolha, a imagem valerá **somente para essa campanha**.

## O que foi confirmado

- A tela já mostra a imagem do template na prévia, mas não oferece troca de imagem nesse local.
- O envio lê a imagem configurada no registro do template; apenas mudar a prévia não alteraria a mensagem enviada.
- A edição de imagem na janela existente salva a alteração nas cópias do modelo. Esse comportamento não será usado aqui, para não modificar outras campanhas.

## Alterações

1. Para templates com cabeçalho de imagem, exibir junto à prévia o botão **Trocar imagem** e a opção **Usar imagem original**.
2. Permitir selecionar JPG ou PNG de até 5 MB, validar o arquivo e atualizar a prévia com a imagem escolhida. Mostrar o andamento do carregamento e uma mensagem clara se falhar.
3. Usar a mesma imagem escolhida nas instâncias selecionadas que enviarem esse template aprovado.
4. Guardar a escolha na campanha, incluindo campanhas agendadas e retomadas, para que o envio real e o histórico mostrem a mesma imagem.
5. Não modificar o template aprovado, sua imagem padrão, modelos mestres, outras campanhas ou mensagens já enviadas. Ao trocar o template principal, limpar a escolha para evitar reaproveitamento acidental.
6. Em campanhas com alternância de templates, vincular a imagem ao template escolhido; outros modelos continuam com suas próprias imagens. Templates sem cabeçalho de imagem não recebem essa substituição.

## Detalhes técnicos

- Criar um controle de imagem focado e integrá-lo à prévia em `src/pages/EnvioMeta.tsx`.
- Armazenar o arquivo com acesso restrito ao usuário autorizado, usando o armazenamento existente e verificando suas permissões antes de reutilizar o fluxo de upload.
- Transportar uma referência de imagem específica do template no registro persistente da campanha, preservando-a nos caminhos serial, rajada, agendado e retomada.
- Validar no servidor a autorização sobre o arquivo e a compatibilidade com o cabeçalho IMAGE do template aprovado. Aplicar a substituição somente à mensagem dessa campanha, sem atualizar registros do modelo nem ampliar acesso a arquivos de terceiros.
- Se houver identificadores de mídia em cache, impedir o reaproveitamento da imagem antiga após a escolha de uma nova.
- Manter aprovação por instância, propriedade dos modelos e proteções de envio atuais.

## Validação

- Testar que a imagem escolhida vence a padrão somente nessa campanha e aparece no conteúdo preparado para a Meta e na prévia salva do envio.
- Testar que outro template, outra campanha e o modelo original permanecem inalterados.
- Testar restauração da imagem original, troca de template, JPG/PNG, limite de 5 MB e bloqueio de arquivo de outro usuário.
- Conferir na tela a seleção da imagem e o retorno à original, sem enviar mensagens reais a clientes.

## Impacto

Não criar novas rotinas, consultas recorrentes ou processos em segundo plano. Haverá apenas armazenamento da imagem e operações pontuais quando você usar a troca, sem aumentar a frequência das automações existentes.