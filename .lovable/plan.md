

## Corrigir instâncias pausando indevidamente no Aquecimento

### Diagnóstico

O fluxo atual cria um ciclo vicioso:
1. Linha 113-129: Reativa PAUSADO → EM_AQUECIMENTO ✅
2. Linha 180-209: Health check via `/instance/status` → formato não reconhecido → volta para PAUSADO ❌

Todas as 77 instâncias estão `ativo: true` na tabela principal mas `PAUSADO` no aquecimento porque o health check falha (a UAZAPI retorna um formato que o código não reconhece) e imediatamente re-pausa.

### Correção

Seguir exatamente o que você pediu: **só pausar se estiver desconectada de verdade** (falha no envio da mensagem).

#### 1. Remover health check preventivo do ciclo automático
- Eliminar o bloco de health check em paralelo (linhas 180-209)
- Confiar que instâncias `ativo: true` estão conectadas
- Se o envio falhar no `whatsapp-ia-responder`, aí sim pausar

#### 2. Tratar falha de envio como motivo para pausar
- Trocar o "fire and forget" (linha 279) por `await` com tratamento de erro
- Se a IA responder com erro de conexão/desconectado, pausar a instância
- Caso contrário, manter ativa

#### 3. Simplificar o código
- Remover ~30 linhas de health check desnecessário
- Resultado: menos código, menos chamadas de rede, menos consumo

### Impacto no consumo
- **Reduz** chamadas: elimina 30-77 fetches de `/instance/status` por ciclo
- Sem aumento de custo — apenas remoção de lógica

### Arquivos
1. **`supabase/functions/whatsapp-aquecimento/index.ts`** — remover health check, pausar só em falha de envio

