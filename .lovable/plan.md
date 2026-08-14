# Credor da caixa de mensagens + IAGO informando o credor

Objetivo: em "Configurar caixa" (menu do botão direito sobre a caixa), poder cadastrar manualmente credores, ativar/desativar e excluir. O credor ativo da caixa passa a ser o credor que o IAGO informa ao cliente quando ele pergunta de qual débito se trata.

## Como vai funcionar

1. Clique com o botão direito na caixa > "Configurar caixa" ganha uma nova seção **Credor da caixa**:
   - Campo de texto + botão "Adicionar" para cadastrar o nome do credor manualmente (ex.: Novo Mundo).
   - Lista dos credores cadastrados naquela caixa, cada linha com um botão de ativar/desativar e um botão de excluir.
   - Apenas um credor fica ativo por caixa: ao ativar um, o anterior é desativado automaticamente.
   - A seção de Qualificação de conversas continua igual, acima.
2. Funciona também na caixa **Padrão** (usa o mesmo identificador sentinela já usado pela qualificação).
3. No atendimento do IAGO:
   - Se a caixa da conversa tiver credor ativo, ele é usado como credor oficial da negociação. O IAGO informa esse nome quando o cliente perguntar de que débito se trata ("é referente ao Novo Mundo").
   - Se a caixa não tiver credor ativo, nada muda: continua usando o credor vindo dos débitos do cliente.
   - Regra reforçada no prompt: nunca inventar outro credor.

## Detalhes técnicos

Banco (nova migração):
- `meta_inbox_folder_credores`: `id`, `folder_id` (uuid, sentinela `00000000-...` para a caixa Padrão), `nome` (text), `ativo` (bool default false), `created_at`, `updated_at` + trigger de updated_at.
- Índice único parcial garantindo no máximo 1 credor ativo por `folder_id`; nome único por caixa.
- GRANT para `authenticated` e `service_role`; RLS: leitura para quem pode ver a caixa (`meta_inbox_folder_can_view`) ou admin; escrita/exclusão apenas admin.

Frontend:
- `src/components/inbox/meta/MetaFolderConfigDialog.tsx`: nova seção "Credor da caixa" (input + lista com Switch e ícone de lixeira), carregando/gravando na nova tabela. Ativar um credor desativa os demais da mesma caixa na mesma operação.

Backend (IAGO):
- `supabase/functions/iago-atendimento/index.ts`: após resolver o contato, buscar o credor ativo da `folder_id` do contato e usá-lo no bloco "DADOS DO SISTEMA" (`Credor: ...`), sobrescrevendo o credor derivado dos débitos quando existir; incluir instrução explícita para informar esse credor quando o cliente perguntar sobre a origem do débito.

Sem cron, sem polling e sem chamadas extras de IA — apenas uma consulta leve por atendimento.
