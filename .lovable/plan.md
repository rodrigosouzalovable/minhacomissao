## Contexto

Confirmei no banco: a etiqueta do Matheus (62 8419-7883) **continua existindo** — está com "Atendente: Wallace" (origem `manual`). O sumiço visual provavelmente é reflexo da bagunça de nomes: hoje existem "Atendente: Wallace" **e** "Atendente: Wallace Maciel" como etiquetas separadas, o mesmo para Anna Flavia, Fernanda, Rodrigo e Yasmim, além de "Enviar boleto" / "Enviar Boleto". Consolidar tudo na versão com nome completo já resolve a inconsistência.

## Plano aprovado

### 1. Consolidar etiquetas duplicadas (dados)
Rodar um script único de dados que:
- Remapeia em `meta_whatsapp_contato_etiquetas` todos os vínculos das etiquetas curtas para a canônica (nome completo):
  - `Atendente: Anna Flavia` → `Atendente: Anna Flavia Leite de Morais`
  - `Atendente: Fernanda` e `Fernanda Estock` → `Atendente: Fernanda Estock de Oliveira Barros`
  - `Atendente: RODRIGO` → `Atendente: RODRIGO RIBEIRO DE SOUZA`
  - `Atendente: Wallace` → `Atendente: Wallace Maciel`
  - `Atendente: Yasmim` → `Atendente: Yasmim Batista Sousa Silva`
  - `Enviar boleto` → `Enviar Boleto`
- Antes de cada `UPDATE`, deleta o vínculo "velho" quando já existe o "novo" no mesmo contato (evita violar o UNIQUE `contato_id + etiqueta_id`).
- Depois do remapeamento, deleta as 7 etiquetas duplicadas de `meta_whatsapp_etiquetas` (ficam sem vínculos).

Resultado final: 7 etiquetas (Anna Flavia, Fernanda, Rodrigo, Wallace, Yasmim, Thailinny e "Enviar Boleto"), todas com nome completo.

### 2. Botão de editar etiquetas (UI)
Em `src/components/inbox/meta/MetaEtiquetasDialog.tsx`:
- Adicionar ícone de lápis ao lado do lixo em cada linha.
- Ao clicar: a linha vira `Input` de nome + paleta de cores + botões "Salvar" / "Cancelar".
- `Salvar` chama `update` em `meta_whatsapp_etiquetas` (RLS já permite dono/admin). A exclusão de auto-etiquetas continua restrita a admin.

## Detalhes técnicos

- Operação de dados via `supabase--insert` (UPDATE/DELETE em tabelas existentes).
- Sem migração de schema, sem edge function nova, sem cron.
- Sem impacto de custo Lovable Cloud.

Aprovando, executo os dois passos em sequência.