## Simplificação da aba "Lembrete Meta"

Trava o template em `lembrete_envio_boleto`, filtra automaticamente as instâncias e pré-preenche as variáveis, removendo qualquer configuração manual de template/variáveis.

### Regras

- **Template único e fixo**: apenas `lembrete_envio_boleto` (nome exato, qualquer idioma/categoria). Usado tanto para D-3 quanto para D0 — não há mais opção "Não enviar D0" nem seletor de template.
- **Instâncias elegíveis**: só aparecem no seletor as instâncias Meta que possuem esse template com `status = APPROVED` na tabela `meta_templates_instancia` (ou equivalente da instância). Instâncias sem o template aprovado são ocultadas da lista.
- **Atualização automática**: sempre que uma nova instância aprovar o template (via sync existente da Meta), ela passa a aparecer no seletor automaticamente na próxima abertura da página — nada de cadastro manual.
- **Variáveis automáticas**: `{{1}} = nome do cliente` e `{{2}} = data de vencimento` gravados fixos na configuração. Sem UI de mapeamento.

### Interface (`/admin/lembrete-meta`)

- Remove: cards "Template D-3", "Template D0", mapeamento de variáveis, opção "Não enviar D0".
- Mantém: toggle ativo/inativo, seletor de instâncias (agora filtrado), delays min/max, histórico de execuções, botões dry-run e "Enviar agora".
- Novo card informativo compacto no topo: nome do template fixo + preview do corpo + badge "Envia em D-3 e D0".
- Se nenhuma instância tem o template aprovado, exibe aviso "Nenhuma instância com o template `lembrete_envio_boleto` aprovado ainda. Aprove o template na Meta para habilitar envios."

### Backend

- `meta-lembrete-tick`: passa a resolver o template dinamicamente por instância — busca em `meta_templates_instancia` o registro com `nome = 'lembrete_envio_boleto'` e `status = 'APPROVED'` para a instância escolhida no round-robin. Se a instância sorteada não tiver o template aprovado, é pulada. Mesmo template usado para D-3 e D0.
- Campos `template_id_d3` / `template_id_d0` / `variaveis_map_d3` / `variaveis_map_d0` deixam de ser lidos pela função (mantidos na tabela por compatibilidade, sem migração destrutiva).
- Variáveis montadas fixas: `{"1": nome_cliente, "2": data_vencimento_BR}`.

### Arquivos

- `src/pages/LembreteMeta.tsx` — remove seletores de template/variáveis, filtra instâncias pelo template aprovado, adiciona card informativo.
- `supabase/functions/meta-lembrete-tick/index.ts` — resolve template por nome fixo dentro do loop, fixa vars `{{1}}`/`{{2}}`, envia mesmo template em D-3 e D0.

Sem migração de banco. Sem mudança no cron.
