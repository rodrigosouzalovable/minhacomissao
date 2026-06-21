## Card de custo de envios — Envio em massa Meta WhatsApp

Adicionar um card no topo da página `/admin/envio-meta` mostrando, em tempo real, o quanto já foi gasto com envios via Meta API, calculado a partir da categoria do template (UTILITY = R$ 0,05 / MARKETING = R$ 0,35 / AUTHENTICATION = R$ 0,05).

### Fonte de dados
Já existem todas as colunas necessárias — nenhuma migração de banco:
- `meta_whatsapp_envios_log` → tem `status`, `template_nome`, `enviado_em`, `user_id`
- `meta_whatsapp_templates` → tem `categoria` (MARKETING / UTILITY / AUTHENTICATION)

O custo é calculado por JOIN no front (template_nome → categoria → preço).

### Tabela de preços (constante no front)
```
UTILITY        → R$ 0,05
AUTHENTICATION → R$ 0,05
MARKETING      → R$ 0,35
SERVICE        → R$ 0,00 (conversa iniciada pelo cliente, raramente em massa)
```
Apenas envios com `status = 'sent'` contam (falhas não são cobradas pela Meta).

### UI — novo card "Custo de envios (Meta)"
Posicionado entre o card "1. Selecione o template" e "2. Instâncias", em grid 3 colunas:

```
┌─────────────── Custo de envios (Meta) ───────────────┐
│  Hoje              Este mês             Total        │
│  R$ 12,40          R$ 348,75            R$ 1.204,30  │
│  248 utility       4 982 utility        17 320 utility│
│  12 marketing      356 marketing        1 204 mkt    │
└──────────────────────────────────────────────────────┘
```

Tooltip no título: "Utility/Auth: R$ 0,05 · Marketing: R$ 0,35. Calculado sobre mensagens enviadas com sucesso."

### Implementação técnica
1. **Novo hook** `src/hooks/useMetaWhatsAppCusto.ts`:
   - Busca todos os templates do usuário (`meta_whatsapp_templates` → `id, nome_template, categoria`)
   - Busca contagem de envios `status='sent'` agrupada por `template_nome` em 3 janelas: hoje (BRT), mês atual (BRT), total
   - Cruza pelo `nome_template`, soma `qtd × preço` por categoria
   - Retorna `{ hoje, mes, total, loadingrefetch }` com `{ valor, qtdUtility, qtdMarketing }`
   - Auto-refresh a cada 30 s + após cada envio em massa (expor `refetch`)

2. **Novo componente** `src/components/meta/CustoEnvioCard.tsx`:
   - Recebe os dados do hook e renderiza o card com 3 colunas (hoje, mês, total)
   - Formata em BRL com `Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' })`
   - Skeleton enquanto carrega

3. **`src/pages/EnvioMeta.tsx`**:
   - Importar e renderizar `<CustoEnvioCard />` no topo
   - Chamar `refetch()` do hook após o `supabase.functions.invoke('send-whatsapp-meta', ...)` retornar, para refletir imediatamente o gasto do disparo recém-feito

### O que NÃO muda
- Edge function `send-whatsapp-meta` (sem alteração — categoria já vem do template)
- Schema do banco (sem migração)
- Tabela `meta_whatsapp_envios_log` (sem novas colunas; cálculo é derivado)