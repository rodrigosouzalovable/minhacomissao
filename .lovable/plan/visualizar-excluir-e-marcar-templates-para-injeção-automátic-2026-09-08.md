# Visualizar, excluir e marcar templates para injeção automática

## O que muda na aba Template > Aplicar em lote

1. **Lista visual dos templates mestre**
   Ao lado do campo "Template mestre", uma lista com todos os modelos. Cada linha mostra o nome, a categoria e dois selos: quantas instâncias já têm o modelo e se ele está marcado para injeção automática.

2. **Abrir cada template em janela (dialog)**
   Clicando no modelo abre uma janela com a prévia completa (cabeçalho, texto, rodapé, botões, imagem quando houver) e três ações:
   - Marcar/desmarcar "Injetar em números novos"
   - Usar este modelo no envio em lote (seleciona no campo acima e fecha a janela)
   - Excluir o modelo (com confirmação; remove também os registros por instância)

3. **Botão de seleção dos modelos de injeção automática**
   Um botão "Modelos para números novos" abre a mesma lista em modo de marcação, com caixas de seleção, "marcar todos" e "limpar". O que ficar marcado é o conjunto que o sistema aplica sozinho em cada número novo conectado.

## Como fica a injeção automática

- Se houver modelos marcados, o sistema passa a enfileirar **exatamente esses** para cada número novo (em vez de escolher pelos mais aprovados). Se nenhum estiver marcado, continua o comportamento atual.
- Todos os marcados podem entrar **no mesmo dia**, sem o limite de 3/5/8/10 por dia — mas sempre **um por vez, com intervalo aleatório de 15 a 25 minutos**, das 09h às 18h e nunca no domingo, para não gerar bloqueio da Meta.
- Se o dia acabar antes de terminar a fila, ela continua no dia seguinte automaticamente.
- As proteções atuais permanecem: pausa após duas rejeições seguidas ou bloqueio/limite da Meta, e avisos no WhatsApp (62991672674) de início, rejeição, pausa e conclusão.

## Detalhes técnicos

- Migração: `meta_templates_mestre.injetar_em_novos boolean not null default false` (+ índice parcial); `meta_templates_onboarding_config.sem_limite_diario boolean not null default true`. Somente administradores podem alterar a marcação (política de update já existente na tabela mestre — validar e ajustar se necessário).
- `src/pages/MetaTemplates.tsx`: nova lista + `TemplateMestreDialog` (prévia reaproveitando o bloco de preview já existente), toggle de marcação, exclusão via `deletarMestre`, e dialog de seleção em massa.
- `supabase/functions/meta-templates-onboarding-enfileirar/index.ts`: quando existirem mestres com `injetar_em_novos = true`, montar a fila com esses ids (excluindo os que a instância já possui), prioridade pela ordem da lista; fallback para a lógica de votos atual.
- `supabase/functions/meta-templates-onboarding-tick/index.ts`: respeitar `sem_limite_diario` (ignora as cotas diárias) mantendo o intervalo de 15–25 min, janela 09h–18h e bloqueio no domingo; mensagem de início ajustada ao novo ritmo.
