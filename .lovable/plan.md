

# Plano: Adicionar status "Com Erros" e botão de Reenviar

## Problema
Quando os envios falham (ex: WhatsApp deslogado), o status mostra "Concluído" porque não há mais pendentes, mas na verdade houve erros. O usuário não consegue reenviar.

## Alterações

### 1. `src/components/LembretesSection.tsx`
- Adicionar novo status `'done_with_errors'` quando `pendentes === 0` mas `erros > 0`
- Mostrar badge amarelo/vermelho "Concluído com erros" nesse caso
- Adicionar botão **"Reenviar com Erro"** que reseta os itens com status `'erro'` na `whatsapp_fila` para `'pendente'` e recarrega os stats
- Manter badge verde "Concluído" apenas quando `erros === 0`

### 2. Lógica de reenvio
- Ao clicar "Reenviar", faz `UPDATE whatsapp_fila SET status = 'pendente', erro_mensagem = null WHERE status = 'erro' AND criado_em do dia`
- Isso permite que o `process-whatsapp-queue` cron reprocesse os itens

### Fluxo
```text
Sem pendentes + sem erros → "Concluído" (verde)
Sem pendentes + com erros → "Concluído com erros" (vermelho) + botão "Reenviar"
Com pendentes → "Enviando..." (amarelo)
Sem registros → "Não iniciado" + botão "Iniciar"
```

