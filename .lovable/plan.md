

## Corrigir Aquecimento: Cadeia Ping-Pong Real com Delays de 30-60s

### Problemas Encontrados

1. **A cadeia ping-pong NÃO funciona**: O `gerar-resposta` faz `await sleep(delay)` dentro do handler (20-120s), mas edge functions têm timeout de ~150s. Com o delay + tempo de IA + envio, a execução estoura. Resultado: só a primeira mensagem é enviada, nunca há resposta.

2. **5 de 10 instâncias estão PAUSADAS**: O health check falhou e elas nunca foram reativadas automaticamente.

3. **Só houve 1 conversa** (09/04) e parou em 1 troca — confirma que a cadeia quebra.

### Solução

#### 1. Delay seguro na cadeia (`whatsapp-ia-responder`)
- Reduzir delay para **30-60 segundos** (como pedido)
- O delay já é feito antes de processar, então funciona dentro do timeout do edge function (~150s)
- Ajustar na linha 304 (`iniciar-conversa`) e 447 (`gerar-resposta`):
  - De: `randomDelay(20000, 90000)` e `randomDelay(20000, 120000)`
  - Para: `randomDelay(30000, 60000)` em ambos

#### 2. Auto-reativar instâncias pausadas (`whatsapp-aquecimento`)
- Após o auto-enrollment, verificar instâncias com status `PAUSADO`
- Fazer health check nelas
- Se estiverem conectadas, mudar status para `EM_AQUECIMENTO`

#### 3. Incluir domingo nos dias ativos
- Adicionar dia 0 (domingo) à lista de dias ativos, para funcionar todos os dias
- Ou manter config existente mas atualizar via SQL

#### 4. Limpar conversas antigas travadas
- Marcar a conversa de 09/04 (status ATIVA, 1 troca) como FINALIZADA para não bloquear o cooldown

### Arquivos Modificados
- `supabase/functions/whatsapp-ia-responder/index.ts` — delays 30-60s
- `supabase/functions/whatsapp-aquecimento/index.ts` — auto-reativar pausados
- SQL para limpar conversa travada e atualizar dias_ativos

### Resultado Esperado
- Instância A envia mensagem → 30-60s → Instância B responde → 30-60s → A responde → ... até 12-18 trocas
- Todo o diálogo visível no Inbox
- Funciona todos os dias automaticamente

