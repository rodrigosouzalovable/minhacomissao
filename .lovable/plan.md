## Objetivo

Garantir que toda etiqueta "Atendente: X" aplicada automaticamente venha travada (cadeado — só admin remove), remover a Thailinny do rodízio de novas conversas, e formalizar quem recebe a etiqueta em cada cenário.

## Regras de atribuição (consolidadas)

Ordem de prioridade quando o contato ainda não tem etiqueta de atendente:

1. **Match por acordo** — telefone bate (últimos 8 dígitos) com algum acordo lançado → etiqueta do atendente que lançou o acordo.
2. **Conversa iniciada por atendente (saída antes de qualquer resposta)** — quando `send-whatsapp-meta` envia com `atendente_nome`, aplica a etiqueta desse atendente.
3. **Cliente respondeu / iniciou** e não caiu em 1 ou 2 → rodízio (round-robin por menor carga), **excluindo "Atendente: Thailinny Nolasco"**.

Em todos os três casos a etiqueta é gravada com `origem='auto_atendente'`, o que já aciona as policies RLS existentes (`meta_contato_etiquetas_owner_delete` / `shared_delete`) que bloqueiam a remoção para não-admins — o cadeado no UI vem daí.

## Mudanças técnicas

### 1. `supabase/functions/send-whatsapp-meta/index.ts` (linhas ~511-536)

- No insert em `meta_whatsapp_contato_etiquetas`, adicionar `origem: 'auto_atendente'` para travar a etiqueta do atendente iniciador.

### 2. `supabase/functions/meta-whatsapp-webhook/index.ts` (linhas ~470-590)

- No fallback de rodízio (linha ~575), trocar `origem: 'manual'` por `origem: 'auto_atendente'` (trava também as atribuições por rodízio).
- Filtrar a lista `atendentes` para excluir toda etiqueta cujo nome (case-insensitive) seja `Atendente: Thailinny Nolasco` antes de calcular carga/rodízio. A etiqueta continua existindo (para conversas antigas), apenas não recebe novas atribuições automáticas.
- O passo 1 (match por acordo) continua respeitando o atendente do acordo mesmo que seja a Thailinny — regra explícita do usuário: "se identificado, marca com o atendente que lançou o acordo".

### 3. UI — cadeado visível

Verificar rapidamente no componente que renderiza os chips de etiqueta no Inbox (`src/pages/InboxMeta.tsx` e/ou `MetaEtiquetasDialog`) se, para etiquetas com `origem='auto_atendente'`, o botão de remover já é escondido/travado com ícone de cadeado quando o usuário não é admin. Se não houver indicação visual, adicionar ícone de cadeado (`Lock`) ao lado do nome da etiqueta travada e desabilitar o "x" para não-admins. Sem alterações de negócio — puramente presentacional.

## Fora de escopo

- Não mexer em etiquetas já aplicadas anteriormente.
- Não apagar nem renomear a etiqueta da Thailinny.
- Não alterar policies RLS (já corretas).
