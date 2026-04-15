

## Arquivar Mensagens Rapidas

### O que muda
Adicionar uma coluna `arquivado` na tabela `whatsapp_mensagens_rapidas`. Mensagens arquivadas continuam visiveis no dialog de gerenciamento (com indicador visual) mas nao aparecem nos botoes de envio rapido na conversa.

### Alteracoes

#### 1. Migration — adicionar coluna `arquivado`
```sql
ALTER TABLE public.whatsapp_mensagens_rapidas
ADD COLUMN arquivado boolean NOT NULL DEFAULT false;
```

#### 2. `src/components/inbox/MensagensRapidasDialog.tsx`
- Adicionar botao de arquivar/desarquivar em cada item (icone Archive/ArchiveRestore)
- Itens arquivados ficam com opacidade reduzida e badge "Arquivado"
- Toggle via `update({ arquivado: !item.arquivado })`

#### 3. `src/pages/WhatsAppInbox.tsx`
- Filtrar `mensagensRapidas` passadas ao `ChatInputBar` para excluir `arquivado === true`
- Ou filtrar direto na query com `.eq('arquivado', false)`

#### 4. Interface `MensagemRapida`
- Adicionar campo `arquivado: boolean` na interface exportada

### Impacto
- Sem aumento de custo (1 coluna boolean)
- Nenhuma mudanca em Edge Functions

