

## Atualização em Massa de Perfil WhatsApp — Gradativa e Anti-Ban

### O que será feito
Criar um recurso de "Aplicar perfil em todas as instâncias" que atualiza nome e/ou foto de todas as instâncias conectadas, uma por vez, com intervalos aleatórios entre cada atualização para simular comportamento humano.

### Como funciona

**Fluxo do usuário:**
1. No diálogo de edição de uma instância, após definir nome e foto, aparece um botão "Aplicar a todas as instâncias"
2. O sistema mostra um diálogo de confirmação com:
   - Quantas instâncias conectadas serão atualizadas
   - Opção de aplicar só nome, só foto, ou ambos
   - Estimativa de tempo total (ex: "~15 a 30 minutos para 10 instâncias")
3. Ao confirmar, o processo roda em segundo plano com barra de progresso

**Estratégias anti-ban implementadas:**
- **Intervalo aleatório entre instâncias**: 60 a 180 segundos (1-3 min) entre cada atualização
- **Jitter adicional**: variação de ±30% no intervalo para parecer orgânico
- **Ordem aleatória**: as instâncias são embaralhadas (não seguem ordem fixa)
- **Separação nome/foto**: quando ambos são alterados, o nome é atualizado primeiro, depois uma pausa extra de 30-90s antes da foto
- **Pausa se erro**: se uma instância falhar, pausa de 5 minutos antes de continuar
- **Horário comercial**: aviso se estiver fora do horário 8h-20h (opcional, apenas informativo)

### Alterações técnicas

**Arquivo: `src/pages/Acionamento.tsx`**
1. Adicionar estado para controle do processo em lote (`bulkUpdateRunning`, `bulkUpdateProgress`, `bulkUpdateLog`)
2. Criar função `handleBulkProfileUpdate` que:
   - Filtra instâncias conectadas
   - Embaralha a ordem
   - Itera uma a uma com `await sleep(randomDelay)`
   - Atualiza nome via `/profile/name` e foto via `/profile/image`
   - Salva cache no banco após cada sucesso
   - Registra log de progresso para o usuário acompanhar
3. Adicionar diálogo de confirmação e progresso com lista mostrando status de cada instância (✓ concluído, ⏳ aguardando, ✗ erro)
4. Botão "Cancelar" para interromper o processo a qualquer momento

### Riscos
- O risco de banimento por alterar perfil é **muito baixo** — o WhatsApp permite alterações de nome e foto normalmente
- O risco aumenta apenas com alterações em massa simultâneas no mesmo segundo, que é exatamente o que estamos evitando
- Os intervalos de 1-3 minutos entre instâncias são conservadores e seguros

### Resultado esperado
- Definir foto e nome em uma instância e aplicar a todas as outras com um clique
- Processo gradual com delays aleatórios, sem padrão detectável
- Progresso visual em tempo real
- Possibilidade de cancelar a qualquer momento

