# Corrigir permissões exibidas no login do Bruno

## Objetivo
Fazer o menu e o acesso direto às páginas respeitarem exatamente as abas marcadas em **Editar Permissões**, sem conceder telas extras por causa de outras funções do usuário.

## Situação confirmada
- Bruno é funcionário e possui somente estas abas salvas: **API Oficial Meta**, **Inbox Meta Oficial** e **Envio Meta**.
- A opção **Parceiro Meta** está ativa para limitar e vincular as instâncias que ele administra.
- Hoje essa opção também libera automaticamente **Campanhas**, **Google Maps Leads** e **Blacklist**, mesmo sem essas abas estarem marcadas.
- Algumas páginas usam regras diferentes do menu; por isso, ocultar o item sozinho não impediria acesso por endereço direto.

## Execução
1. Separar a função **Parceiro Meta** das permissões de navegação: ela continuará controlando os números e recursos internos vinculados, mas não acrescentará abas ao menu.
2. Fazer **Campanhas**, **Google Maps Leads** e **Blacklist** aparecerem somente quando estiverem explicitamente liberadas em **Editar Permissões** — administradores globais permanecem com acesso completo.
3. Alinhar a proteção das páginas com a mesma lista de permissões, impedindo acesso direto a uma aba não liberada.
4. Manter intactos os acessos já concedidos ao Bruno: API Oficial Meta, Inbox Meta Oficial e Envio Meta, bem como seus vínculos de instâncias.
5. Validar no login do Bruno que aparecem somente as três abas liberadas e que as telas não liberadas recusam acesso direto.

## Detalhes técnicos
- Centralizar a decisão de acesso por caminho para evitar divergência entre menu e páginas.
- Preservar as restrições de dados existentes para instâncias Meta vinculadas ao parceiro.
- Não alterar dados, campanhas, mensagens ou permissões de outros usuários.
