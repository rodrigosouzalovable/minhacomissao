

## Integrar contadores de tempo e destino na tabela "Em Aquecimento"

### Problema
O componente `AquecimentoDashboard` com os contadores de tempo (CountdownTimer) e estimativa de destino existe no código (`src/components/aquecimento/AquecimentoDashboard.tsx`), mas **nunca é importado** na página `Aquecimento.tsx`. A página renderiza sua própria tabela simples sem esses indicadores.

### Solução
Em vez de substituir o layout inteiro (que o usuário já conhece), vou **adicionar os contadores diretamente na tabela existente** "Em Aquecimento" da página `Aquecimento.tsx`:

### Arquivo: `src/pages/Aquecimento.tsx`

1. **Importar/copiar as funções auxiliares** (`getBrasiliaTime`, `getNextCronSlot`, `findNextActiveDay`, `CountdownTimer`) do `AquecimentoDashboard.tsx`

2. **Buscar agendamentos e config** no `loadAll()`:
   - Carregar `whatsapp_aquecimento_config` (horário comercial, dias ativos)
   - Carregar `whatsapp_aquecimento_agendamentos` com status `AGENDADO`
   - Calcular o próximo slot do cron

3. **Adicionar banner de status** (Sistema Ativo / Fora do horário) com countdown global, logo acima da tabela "Em Aquecimento"

4. **Adicionar coluna "Próxima Msg"** na tabela "Em Aquecimento" com:
   - CountdownTimer mostrando tempo restante
   - Nome da instância destino estimada (round-robin)
   - "Limite atingido ✓" quando `interacoes_hoje >= limite_diario`
   - "Fora do horário" quando aplicável

### Resultado
O usuário verá na mesma tela que já conhece: a tabela com uma coluna extra mostrando quando será a próxima mensagem e para quem, com contador regressivo em tempo real.

