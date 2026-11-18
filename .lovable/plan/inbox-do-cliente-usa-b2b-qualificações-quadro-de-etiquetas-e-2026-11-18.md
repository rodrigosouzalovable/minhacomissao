# Inbox do cliente USA B2B: qualificações, quadro de etiquetas e dicas no idioma escolhido

Vale só para quem tem USA B2B ativado. Para você e a equipe, nada muda.

## 1. Filtrar por qualificação
- As qualificações da empresa não aparecem mais. A lista começa vazia e mostra só as que o próprio cliente criar.
- A trava também vale no servidor, como fizemos nas etiquetas. Assim, as qualificações da empresa não chegam até ele por nenhum caminho.
- Dentro do quadro entra o botão "Manage qualifications", que abre a janela de gerenciar qualificações.
- Os textos do quadro e dessa janela aparecem no idioma escolhido (EN/ES/PT): "No qualifications yet", "Clear", "Manage qualifications" etc.

## 2. Quadro "Filtrar por etiqueta" menor
- Hoje o quadro tem altura fixa grande. Ele passa a ter só a altura das etiquetas existentes e cresce conforme novas etiquetas são criadas.
- A partir de cerca de 420px de altura, aparece a barra de rolagem.
- Essa mudança vale para todos os usuários, porque só melhora o visual.

## 3. Dicas ao passar o mouse, no idioma escolhido
- Todas as dicas da barra de filtros e da lista de conversas passam a ser traduzidas. Exemplos: "Filtrar conversas com janela 24h ativa", "Filtrar por etiquetas", "Filtrar por qualificações", "Editar cor", "Escolher outra cor", "Limpar".

## Detalhes técnicos
- Migration: nova política RLS em `meta_qualificacoes` e `meta_contato_qualificacao`. Clientes USA (`cliente_usa_config.usa_b2b`) só leem e gravam linhas em que `user_id = auth.uid()`. Antes, confirmo as colunas atuais de dono.
- `InboxMeta.tsx`: usar `tr()` em todos os `title`/`aria-label`. Adicionar as novas chaves ao dicionário EN/ES. Trocar `h-[min(420px,...)]` por `max-h-[min(420px,...)]` com `overflow-y-auto`. Adicionar o botão que abre `MetaQualificacaoDialog`.
- `MetaQualificacaoDialog.tsx`: receber o idioma e traduzir os rótulos.
- Sem custo extra de nuvem.
