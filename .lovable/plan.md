
# Consultoria WhatsApp API — página /consultoria

Área de curso independente do MEUS ACORDOS, com login próprio, 5 módulos, materiais, dúvidas e painel admin.

## 1. Banco de dados

Novo enum e role dedicada. **Não** mexe em `user_roles` (evita reescrever RLS existente); usa flag em `profiles` + tabela própria.

Tabelas (todas em `public`, com GRANT + RLS):

- `consultoria_alunos` — `id`, `user_id` (FK `auth.users`, unique), `nome`, `email`, `empresa`, `telefone`, `ativo`, `is_admin_consultoria` bool, timestamps.
- `consultoria_modulos` — `id` int PK (1–5), `titulo`, `descricao`, `duracao`, `ordem`.
- `consultoria_aulas` — `id` uuid, `modulo_id` int FK, `numero` int, `titulo`, `conteudo_md` text (markdown rico), `video_url` text nullable, `ordem`, timestamps. Unique (`modulo_id`, `numero`).
- `consultoria_materiais` — `id` uuid, `modulo_id` int nullable, `aula_id` uuid nullable, `tipo` (`pdf|planilha|checklist|video|link`), `nome`, `descricao`, `storage_path` text nullable, `url_externa` text nullable, timestamps.
- `consultoria_progresso` — `id` uuid, `aluno_id` FK, `aula_id` FK, `status` (`nao_iniciado|em_andamento|concluido`), `progresso` int, `data_inicio`, `data_conclusao`, timestamps. Unique (`aluno_id`, `aula_id`).
- `consultoria_duvidas` — `id`, `aluno_id`, `modulo_id` nullable, `aula_id` nullable, `pergunta`, `resposta`, `status` (`pendente|respondida`), `criado_em`, `respondido_em`, `respondido_por`.

RLS resumida (linguagem simples):
- Aluno vê/edita **apenas seus próprios** registros de progresso e dúvidas.
- Módulos, aulas e materiais: leitura para qualquer aluno autenticado ativo.
- Admin da consultoria (`is_admin_consultoria=true` OU `has_role(admin)` no sistema atual) faz CRUD em tudo.
- Trigger `handle_new_consultoria_user` cria linha em `consultoria_alunos` quando admin cadastra.

Seed inicial: os 5 módulos + as 28 aulas listadas no briefing, com rascunho de conteúdo (markdown) por aula gerado a partir do briefing. Materiais entram vazios (upload pelo admin).

Storage: bucket privado `consultoria-materiais` + policy leitura para alunos autenticados, escrita para admin. URLs assinadas para download.

## 2. Rotas frontend

`/consultoria` decide sozinha: se deslogado, mostra formulário de login embutido; se logado como aluno, dashboard.

- `/consultoria` — login + dashboard (mesmo componente, condicional).
- `/consultoria/modulo/:id` — lista de aulas do módulo.
- `/consultoria/aula/:modulo/:aula` — conteúdo da aula (markdown), botão "marcar concluído", navegação anterior/próxima, materiais relacionados.
- `/consultoria/materiais` — todos os materiais, filtro por módulo, botão download.
- `/consultoria/duvidas` — formulário + histórico.
- `/consultoria/admin` — só para admin consultoria: gerenciar alunos (criar via edge function `create-consultoria-aluno`), ver progresso, editar aulas (editor markdown), upload de materiais, responder dúvidas.

Guard próprio `ConsultoriaRoute` — não usa `AuthProvider` do sistema principal (para manter isolamento visual e não carregar hooks pesados de MEUS ACORDOS), mas reusa o mesmo cliente Supabase e sessão. Aluno com role `funcionario/gestor/admin` do MEUS ACORDOS ainda pode acessar se tiver linha em `consultoria_alunos`.

Adicionar as rotas em `src/App.tsx` **fora** dos providers pesados (`AutoSendProvider`, `WhatsAppSendingProvider`, etc.) — envolvidas só em `AuthProvider` + query client.

## 3. Edge functions

- `create-consultoria-aluno` — admin cria `auth.users` + `consultoria_alunos` com senha inicial (service role).
- `consultoria-material-signed-url` — retorna URL assinada respeitando RLS.

## 4. UI/UX

- Layout limpo, cores da marca (reusa tokens de `index.css`).
- Dashboard: card por módulo com barra de progresso animada, % total, botão "Continuar onde parei" (última aula com `em_andamento` ou primeira `nao_iniciado`).
- Aula: renderer markdown (`react-markdown` já instalável), player de vídeo simples via `<video>` ou embed YouTube, sidebar com aulas do módulo.
- Responsivo mobile-first, sheet lateral no mobile para navegação.
- Feedback via `sonner` (toaster já existe).

## 5. Detalhes técnicos

- Markdown: adicionar `react-markdown` + `remark-gfm`.
- Editor admin: `textarea` grande com preview markdown ao lado (sem depender de editor rico externo neste primeiro corte).
- Progresso calculado no cliente a partir de `consultoria_progresso` × total de aulas do módulo.
- Sem alteração em rotas/lógica do MEUS ACORDOS atual.

## 6. Entrega em fases

1. Migration (tabelas, RLS, GRANT, seed módulos+aulas com rascunho, bucket + policies).
2. Rotas e guard, tela de login+dashboard em `/consultoria`.
3. Página de módulo e aula com marcação de progresso.
4. Materiais + dúvidas (aluno).
5. Painel admin: alunos, upload de materiais, editor de aulas, respostas às dúvidas.

## Diagrama de navegação

```text
/consultoria ──(deslogado)──> login inline
     │
     └──(logado)──> Dashboard
                       ├── /consultoria/modulo/:id ── /consultoria/aula/:mod/:aula
                       ├── /consultoria/materiais
                       ├── /consultoria/duvidas
                       └── /consultoria/admin  (só admin consultoria)
```
