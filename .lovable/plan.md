## Objetivo

Criar uma aba "Arquivados" no WhatsApp Inbox para isolar as conversas internas entre as próprias instâncias do sistema (números do aquecimento conversando entre si), evitando que poluam a lista lateral principal usada para falar com clientes.

## Como funciona

1. Cada contato (`whatsapp_contatos`) ganha uma flag `arquivado` (boolean, default `false`).
2. O sistema marca automaticamente como `arquivado = true` qualquer contato cujo telefone corresponda a outra instância ativa do próprio sistema (ou seja, dois WhatsApp da casa conversando entre si pelo aquecimento).
3. A lista lateral principal passa a esconder os arquivados; eles aparecem apenas na nova aba "Arquivados".

## Detecção de "conversa interna"

Para identificar que um contato é na verdade outro número da casa:

- Será adicionada uma coluna `telefone` em `user_whatsapp_instances` (preenchida automaticamente quando a instância conecta via `whatsapp-qr` — o campo `phone` já é retornado pela UAZAPI, só não está sendo persistido).
- Um job de backfill/normalização preencherá os telefones das 163 instâncias ativas consultando o status da UAZAPI (mesma chamada já usada hoje).
- Um trigger no `whatsapp_contatos` (INSERT/UPDATE de `telefone`) marca `arquivado = true` automaticamente quando o sufixo de 8 dígitos do contato bate com o telefone de qualquer instância ativa.
- Um script de backfill marca como arquivados todos os contatos atuais que já se enquadrem na regra.

## Mudanças na UI (`src/pages/WhatsAppInbox.tsx`)

- Acima da lista de conversas, novo `Tabs` com 2 abas: **"Conversas"** (padrão) e **"Arquivados"** (com contador).
- A query `fetchContatos` filtra `arquivado = false` na aba Conversas e `arquivado = true` na aba Arquivados.
- Realtime continua funcionando igual; ao mudar de aba, refaz a busca.
- No menu de contexto da conversa (`ConversaContextMenu`), adicionar a ação **"Arquivar"** / **"Desarquivar"** para permitir override manual.
- Badge no contador da aba "Arquivados" só aparece se houver não-lidos lá dentro (não devem haver normalmente, mas serve de salvaguarda).

## Mudanças no banco (migration)

```sql
-- 1. Coluna de arquivamento
ALTER TABLE whatsapp_contatos ADD COLUMN arquivado boolean NOT NULL DEFAULT false;
CREATE INDEX idx_whatsapp_contatos_arquivado ON whatsapp_contatos(instancia_id, arquivado, ultima_mensagem_em DESC);

-- 2. Telefone da instância
ALTER TABLE user_whatsapp_instances ADD COLUMN telefone text;
CREATE INDEX idx_user_whatsapp_instances_telefone_suffix
  ON user_whatsapp_instances (right(regexp_replace(telefone,'\D','','g'), 8))
  WHERE ativo = true AND telefone IS NOT NULL;

-- 3. Função + trigger de auto-arquivamento
CREATE OR REPLACE FUNCTION public.auto_arquivar_contato_interno()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  suf text := right(regexp_replace(NEW.telefone,'\D','','g'), 8);
BEGIN
  IF EXISTS (
    SELECT 1 FROM user_whatsapp_instances
    WHERE ativo = true
      AND telefone IS NOT NULL
      AND right(regexp_replace(telefone,'\D','','g'), 8) = suf
      AND id <> NEW.instancia_id
  ) THEN
    NEW.arquivado := true;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_auto_arquivar_contato_interno
BEFORE INSERT OR UPDATE OF telefone ON whatsapp_contatos
FOR EACH ROW EXECUTE FUNCTION auto_arquivar_contato_interno();
```

Backfill (executado na própria migration, depois que os telefones das instâncias forem preenchidos):
```sql
UPDATE whatsapp_contatos c
SET arquivado = true
WHERE arquivado = false
  AND EXISTS (
    SELECT 1 FROM user_whatsapp_instances i
    WHERE i.ativo
      AND i.telefone IS NOT NULL
      AND right(regexp_replace(i.telefone,'\D','','g'),8) = right(regexp_replace(c.telefone,'\D','','g'),8)
      AND i.id <> c.instancia_id
  );
```

## Mudanças nas Edge Functions

- `whatsapp-qr`: ao detectar `connected: true` com `phone`, gravar `telefone` na linha de `user_whatsapp_instances`.
- Nova função `backfill-instance-phones` (one-shot, disparada manualmente por botão admin no Aquecimento) que percorre todas as instâncias ativas, consulta status na UAZAPI e popula a coluna `telefone`. Após esse passo, o backfill SQL acima conclui o arquivamento das conversas internas já existentes.

## Arquivos afetados

- Nova migration SQL (alter + trigger + backfill)
- `supabase/functions/whatsapp-qr/index.ts` — persistir telefone ao conectar
- `supabase/functions/backfill-instance-phones/index.ts` (novo)
- `src/pages/WhatsAppInbox.tsx` — abas Conversas/Arquivados, filtro arquivado, ação manual
- `src/components/inbox/ConversaContextMenu.tsx` — opção Arquivar/Desarquivar
- `src/components/aquecimento/AquecimentoDashboard.tsx` — botão "Sincronizar telefones das instâncias" (uma vez)

## Custo Lovable Cloud

Impacto mínimo: 1 coluna boolean + 1 coluna texto + 1 trigger leve em INSERT/UPDATE de contatos (operação O(1) com índice). A função de backfill roda uma única vez. Sem aumento recorrente de consumo.