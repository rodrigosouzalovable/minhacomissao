

## Sincronizar Instâncias entre Acionamento e Aquecimento

### Problema
- Acionamento mostra 58 instâncias ativas, mas Aquecimento mostra apenas 53
- 5 instâncias novas (adicionadas em 12/04) ainda não foram inscritas no aquecimento
- O auto-enrollment só roda quando o cron dispara (a cada 15 min), não em tempo real
- Não há lógica para **desativar** instâncias no aquecimento quando são desativadas no Acionamento

### Solução

#### 1. Sincronização bidirecional no `whatsapp-aquecimento/index.ts`
- **Enrollment**: Manter o auto-enrollment existente (já funciona)
- **Desativação**: Adicionar lógica para pausar instâncias no aquecimento quando `ativo=false` na tabela principal
- Instâncias com `ativo=false` em `user_whatsapp_instances` → status `PAUSADO` em `whatsapp_aquecimento_instancias`

#### 2. Sincronização imediata no Dashboard (`AquecimentoDashboard.tsx`)
- Ao carregar o dashboard, verificar instâncias ativas que não estão no aquecimento e inscrever automaticamente (chamando a edge function ou inserindo diretamente)
- Mostrar contagem correta baseada nas instâncias ativas reais

#### 3. Trigger de sincronização via database trigger (mais robusto)
- Criar um trigger SQL na tabela `user_whatsapp_instances` que:
  - Quando `ativo` muda para `true` → cria registro em `whatsapp_aquecimento_instancias` se não existir (ou reativa se REMOVIDO/PAUSADO)
  - Quando `ativo` muda para `false` → muda status para `PAUSADO` em `whatsapp_aquecimento_instancias`
  - Quando instância é inserida com `ativo=true` → auto-inscreve no aquecimento

### Arquivos Modificados
1. **SQL Migration** — trigger `sync_aquecimento_on_instance_change` na tabela `user_whatsapp_instances`
2. **SQL Migration** — inscrever as 5 instâncias faltantes imediatamente
3. **`supabase/functions/whatsapp-aquecimento/index.ts`** — adicionar sync de desativação no ciclo (backup do trigger)

### Resultado
Instâncias sempre sincronizadas: ativar/desativar no Acionamento reflete instantaneamente no Aquecimento via trigger de banco.

