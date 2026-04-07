

## Plano: Monitor de Envios WhatsApp

### Resumo

Criar uma nova página `/monitor-envios` com dashboard de monitoramento em tempo real dos envios WhatsApp por instância, usando as tabelas existentes `whatsapp_mensagens` e `user_whatsapp_instances`.

### Viabilidade

- A tabela `whatsapp_mensagens` já registra direção (`saida`/`entrada`), `instancia_id` e `timestamp_msg` -- tudo que precisamos para contar envios por instância por dia.
- As instâncias já estão cadastradas em `user_whatsapp_instances` com campos `nome`, `ativo`, `robo`, `apenas_lembretes`.
- Não é necessário criar Edge Functions -- as queries podem ser feitas direto pelo Supabase client.
- O sistema já tem ~40 instâncias ativas.

### Adaptações ao nosso sistema

O prompt do DeepSeek é genérico. Aqui estão as adaptações:

1. **Direção**: usar `direcao = 'saida'` (não `outbound`)
2. **Limite diário**: o prompt sugere 10/dia fixo, mas nosso acionamento usa ~30 msgs/dia por robô. Vamos tornar configurável por instância, default 30.
3. **Delay**: nosso sistema já usa intervalo de 300-500 segundos (5-8 min), não 81 segundos.
4. **Controle de pausa**: usar o campo `ativo` já existente na tabela de instâncias.
5. **Gráfico de evolução**: implementar como opcional (v2), focar primeiro no dashboard funcional.

### Etapas de implementação

**1. Criar página `MonitorEnvios.tsx`**
- Cards de resumo: total enviadas hoje, instâncias ativas, progresso geral, tempo estimado para término
- Tabela com cada instância: nome, enviadas hoje (barra de progresso), último envio, próximo envio estimado, status (ativo/pausado/limite), tipo (robô/lembretes)
- Botões: pausar/retomar por instância
- Configurações: limite diário (default 30), delay entre mensagens

**2. Criar hook `useMonitorEnvios.ts`**
- Query que conta mensagens de saída por instância no dia atual
- Polling a cada 30 segundos para atualização automática
- Buscar horário do último envio por instância

**3. Adicionar rota e menu**
- Nova rota `/monitor-envios` em `App.tsx` com `PermissionRoute`
- Novo item no menu lateral em `AppLayout.tsx` (ícone: `Activity` ou `BarChart3`)

**4. Lógica de status**
- Verde: abaixo de 80% do limite
- Amarelo: 80-99% do limite
- Vermelho: limite atingido
- Cinza: pausado (ativo = false)

**5. Previsão de próximo envio**
- Calcular com base no último envio + delay médio configurado + posição round-robin

### Arquivos a criar/alterar

| Arquivo | Ação |
|---------|------|
| `src/pages/MonitorEnvios.tsx` | Criar |
| `src/hooks/useMonitorEnvios.ts` | Criar |
| `src/App.tsx` | Adicionar rota |
| `src/components/layout/AppLayout.tsx` | Adicionar item no menu |

### O que NÃO será feito nesta versão

- Gráfico de evolução ao longo do dia (pode ser adicionado depois)
- Edge Function dedicada (desnecessária, queries diretas são suficientes)
- "Resetar contagem" (perigoso, pode apagar dados reais)
- Configuração de limite persistida em banco (usaremos estado local inicialmente; pode ser migrado para tabela depois)

