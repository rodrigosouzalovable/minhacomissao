## Objetivo
Permitir editar o **Nome** e o **Telefone de exibição** de cada instância diretamente no card "2. Instâncias" da tela "Envio em massa — Meta WhatsApp", salvando permanentemente em `meta_whatsapp_instances`.

## Mudanças

### `src/pages/EnvioMeta.tsx` (apenas frontend)
1. Adicionar ícone `Pencil` (lucide-react) ao lado do nome/telefone de cada item.
2. Ao clicar no lápis, o item entra em modo edição:
   - Dois `Input` pequenos: um para `nome`, outro para `display_phone`.
   - Botões "Salvar" (ícone Check) e "Cancelar" (ícone X).
3. Ao salvar:
   - `supabase.from("meta_whatsapp_instances").update({ nome, display_phone }).eq("id", instancia.id)`
   - Atualiza o estado local `instancias` para refletir sem refetch completo.
   - Toast de sucesso/erro.
4. Clicar no lápis NÃO marca/desmarca o checkbox (stopPropagation).
5. Manter o restante do card intacto (checkbox, badge de restantes, tier).

## Observações
- `phone_number_id` e `tier_diario` ficam de fora desta edição (conforme escolhido).
- A tabela `meta_whatsapp_instances` já tem as colunas `nome` e `display_phone` — sem migração de schema.
- Salva permanente (afeta outras telas que listam a instância).
