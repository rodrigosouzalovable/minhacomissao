# Corrigir "Reenviar falhas" do template lead_followup_sem_resposta

## O que aconteceu

O botão "Reenviar falhas" reenvia sem indicar quais números devem ser tratados. Sem essa lista, o sistema carrega **todos os números conectados** — inclusive os do WhatsApp comum (UAZAPI) e os de parceiros — e marca todos como "ENVIADO" antes de decidir quem realmente precisava de reenvio.

Confirmado no banco para `lead_followup_sem_resposta`:

- 132 linhas: 129 em "ENVIADO" e 3 em "APPROVED"
- Dos 132, apenas 53 são números da API Oficial Meta; 79 são números do WhatsApp comum (que nem aceitam modelo Meta) e 6 são de parceiros
- Por isso a lista mostra códigos longos em vez de nomes: são números que essa tela não exibe

Ou seja: os "ENVIADO" em massa são um efeito colateral do clique, não envios reais. Eles ficam presos nesse estado porque o número é ignorado logo depois.

## O que será corrigido

1. **Reenviar falhas passa a agir só sobre falhas.** O reenvio considera apenas números que estão em "FALHA" ou "REJEITADO" naquele modelo. Nada mais é marcado como "ENVIADO".
2. **Números que não são da API Oficial Meta ficam de fora.** Envio e reenvio passam a ignorar números do WhatsApp comum e de parceiros, que nunca deveriam entrar nessa lista.
3. **Limpeza dos registros indevidos.** As linhas criadas para números do WhatsApp comum nesse modelo são removidas, e as que ficaram travadas em "ENVIADO" sem existir na Meta voltam ao estado real (falha/pendente conforme a consulta à Meta).
4. **Botão com confirmação e contagem.** Antes de reenviar, a tela informa quantos números realmente estão com falha; se não houver nenhum, avisa e não chama nada.
5. **Lista mais legível.** Quando o número não pertencer à visão atual, a linha mostra o telefone/identificação disponível em vez de só o código interno.

## Detalhes técnicos

- `supabase/functions/meta-criar-template-lote/index.ts`:
  - filtrar a consulta de instâncias por `provider = 'meta'` e excluir `meta_instance_parceiros`
  - quando `apenas_falhas` for verdadeiro, resolver a lista de instâncias a partir de `meta_templates_instancia` com `status in ('FALHA_ENVIO','REJECTED')` **antes** do pré-marque, e não aplicar o `upsert` de pré-marcação nesse modo
  - retornar `elegiveis: 0` quando não houver falhas
- Migração de limpeza: apagar linhas de `meta_templates_instancia` cujo `instancia_id` seja de provider `uazapi`, e reconciliar as "ENVIADO" sem correspondência em `meta_whatsapp_templates` (marcar para reverificação na Meta pelo cron já existente).
- `src/pages/MetaTemplates.tsx`: `reenviarFalhas` calcula a contagem local de falhas, exibe confirmação, desabilita o botão sem falhas; detalhe por instância com fallback de rótulo.
