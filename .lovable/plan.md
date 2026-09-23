# Busca e favoritos em todos os seletores de template

## Objetivo
Padronizar os locais onde o usuário escolhe um template, permitindo pesquisar pelo nome, favoritar ou desfavoritar pela estrela e visualizar os favoritos primeiro.

## Experiência do usuário
- Substituir os seletores simples por um seletor pesquisável, mantendo o nome, idioma, categoria, conteúdo e indicadores que cada tela já apresenta.
- Exibir uma estrela em cada opção; estrela preenchida indica favorito e estrela vazia permite favoritar.
- Clicar na estrela não seleciona nem fecha a lista, permitindo organizar os favoritos enquanto pesquisa.
- Ordenar primeiro os favoritos e depois os demais em ordem alfabética.
- A busca ignora maiúsculas, minúsculas e acentos e procura pelo nome do template; nas listas que já mostram o conteúdo, o texto continuará visível.
- Manter a seleção atual mesmo ao favoritar, desfavoritar ou limpar a pesquisa.
- Mostrar estados claros para carregamento, lista vazia e nenhum resultado encontrado.

## Locais abrangidos
- Inbox Meta Oficial: **Nova Conversa Meta**.
- Inbox Meta Oficial: **Reabrir/enviar template dentro da conversa**.
- **Envio em massa — Meta WhatsApp**.
- **Certificado Digital**, na escolha do template de prospecção.
- **Templates Meta**, na escolha do template mestre para aplicar em lote.
- Usar o mesmo componente nos novos seletores de template que forem adicionados ao site.

Telas que apenas criam, editam, sincronizam ou visualizam templates não serão alteradas, pois nelas não existe uma escolha operacional de template.

## Favoritos por usuário
- Criar uma preferência individual no banco, vinculada ao usuário autenticado.
- Identificar o favorito pelo nome lógico e idioma do template, para que o mesmo template permaneça favorito mesmo quando existe uma cópia diferente em cada instância Meta.
- Separar tipos de template quando necessário, evitando que modelos de origens diferentes com nomes iguais se misturem.
- Sincronizar os favoritos entre dispositivos e sessões do mesmo usuário.
- Permitir somente que cada usuário veja, adicione e remova os próprios favoritos.

## Implementação técnica
- Criar uma tabela leve de favoritos com chave única por `user_id + tipo + nome + idioma`, `GRANT` para usuários autenticados e serviço interno, e RLS por `auth.uid()`.
- Criar um hook compartilhado para carregar e alternar favoritos, com atualização imediata da estrela e reversão em caso de erro.
- Criar um seletor reutilizável com busca, agrupamento visual de favoritos e suporte ao conteúdo personalizado de cada opção.
- Adaptar os cinco fluxos mapeados sem alterar suas regras atuais de aprovação, categoria UTILITY, compatibilidade de instância, variáveis, pré-visualização ou envio.
- Regenerar os tipos do banco após a migração.

## Validação
- Confirmar que favoritar e desfavoritar funciona e persiste após recarregar a página e em outro seletor.
- Confirmar isolamento: um usuário não enxerga os favoritos de outro.
- Testar pesquisa por nome com acentos e diferenças de maiúsculas/minúsculas.
- Verificar que favoritos aparecem primeiro, sem duplicar templates agrupados por instância.
- Testar Nova Conversa, reabertura dentro da conversa, envio em massa, Certificado Digital e aplicação em lote em telas desktop e móvel.
- Validar que seleção, variáveis, prévia e envio continuam funcionando como antes.

## Impacto de custo
A nova tabela é pequena e acessada somente quando um seletor de template é aberto. O impacto esperado no Lovable Cloud é desprezível, sem cron, polling ou processamento contínuo novo.
