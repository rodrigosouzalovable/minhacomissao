# Isolar campanhas e pastas por usuário

## Situação confirmada

- A lista da aba **Campanhas** já aplica o filtro pelo login atual (`user_id`), inclusive para administradores e Parceiros Meta.
- O carregamento direto de uma campanha e as atualizações em tempo real também usam o login atual.
- O filtro **Todas as Pastas** consulta as pastas permitidas pelas regras atuais: para um Parceiro Meta, somente pastas criadas por ele ou compartilhadas explicitamente com ele.
- Porém, as tabelas de campanhas e itens ainda possuem regras adicionais por empresa/tenant. Como as regras são somadas, isso pode permitir que um usuário acesse campanhas de outro usuário da mesma empresa fora da tela principal.
- O resultado calculado da campanha está restrito a administradores, o que não combina com o acesso individual dos Parceiros Meta aos detalhes das próprias campanhas.

## Correção

1. Remover das campanhas e dos itens as regras amplas por empresa/tenant, mantendo acesso somente quando o `user_id` da campanha for o login atual.
2. Garantir que os resultados, entregas, itens, blacklist, exportações e detalhes só possam ser lidos ou recalculados pelo dono da campanha.
3. Remover a exceção administrativa das ações da campanha, para que até o administrador controle somente campanhas iniciadas pelo próprio login.
4. Manter o filtro explícito pelo usuário também na tela, no carregamento individual e nas atualizações em tempo real como proteção adicional.
5. Manter **Todas as Pastas** limitado, para Parceiros Meta, às pastas próprias e às pastas em que foram adicionados como membros; nenhuma pasta apenas da conta principal será listada.

## Validação

- Entrar com o administrador e confirmar que aparecem somente campanhas abertas por esse login.
- Entrar com um Parceiro Meta e confirmar que aparecem somente campanhas abertas por ele.
- Tentar consultar, abrir, exportar e controlar uma campanha de outro usuário pelo identificador e confirmar acesso negado.
- Conferir que o Parceiro Meta vê em **Todas as Pastas** apenas pastas próprias ou compartilhadas, e que os filtros continuam encontrando as campanhas corretas.

## Detalhes técnicos

- Ajustar as políticas de acesso de `envio_meta_job`, `envio_meta_job_item` e `envio_meta_job_resultado` para propriedade estrita por campanha.
- Ajustar as funções de resumo/cálculo para validar o dono da campanha antes de retornar ou gravar dados.
- Ajustar a função de controle da campanha para rejeitar qualquer ação quando `job.user_id` for diferente do usuário autenticado.
- Preservar as regras atuais de `meta_inbox_folders` e `meta_inbox_folder_members`, reforçando o filtro explícito na consulta da página se necessário.
