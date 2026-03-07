

## Análise do Fluxo de Geração de Boleto no CobMais

### O que os prints mostram

O fluxo completo no CobMais para gerar um boleto tem 10 passos com tratamento de erro:

1. Pesquisar CPF → Abrir ficha
2. Clicar em "Cálculo"
3. Digitar valor em "Valor Final" (respeitando mínimo exibido)
4. Clicar "Atualizar"
5. Clicar "Salvar Acordo"
6. Na ficha, localizar evento "Acordo" → menu dropdown → "Emitir Boletos"
7. Na modal, "Selecionar Todos" → "Imprimir"
8. **Se aparecer erro de email**: ir em E-mail → Novo → digitar `email@email.com` → Salvar → repetir emissão
9. Reimprimir boleto após corrigir email
10. Capturar URL da nova aba (formato: `https://app.cobmais.com.br/cob/gerapdf.aspx?assessoria=...&id=...&format=inline`)

### Onde está o problema

O código do sistema (edge functions) está correto. O fluxo é:
- Chatbot → `triggerCobMaisRobot()` → edge function `automacao-cobmais` → servidor Playwright local (via ngrok)
- O servidor Playwright retornou `{sucesso: true}` **sem `boleto_url`**, indicando que ele não completou o fluxo ou não capturou a URL

### O que pode ser melhorado no sistema

**1. Adicionar logging detalhado no `automacao-cobmais`** para ações `gerar_boleto` — registrar quando o resultado não contém `boleto_url` mesmo sendo "sucesso"

**2. Validar resultado do robô** — marcar como erro se `gerar_boleto` retorna sem `boleto_url`:

No `automacao-cobmais/index.ts`, após receber resposta do servidor Playwright, verificar:
```
if (acao === 'gerar_boleto' && resultado.success !== false && !resultado.boleto_url) {
  // Marcar como erro — robô não retornou o link
}
```

**3. Melhorar mensagem de erro no chatbot** — incluir detalhes sobre o que falhou para facilitar debug

### O que o servidor Playwright local precisa implementar

O robô local precisa seguir exatamente os 10 passos que você documentou, incluindo:
- O tratamento do erro de email (passo 8) — preencher `email@email.com` automaticamente se necessário
- Capturar a URL da nova aba aberta (formato `gerapdf.aspx?...`)
- Retornar `{ sucesso: true, boleto_url: "https://app.cobmais.com.br/cob/gerapdf.aspx?..." }` na resposta JSON

### Arquivos a modificar

- `supabase/functions/automacao-cobmais/index.ts` — validação de `boleto_url` na resposta do robô + logging
- `supabase/functions/whatsapp-chatbot/index.ts` — logging mais detalhado do resultado

### Nota

A correção definitiva depende do servidor Playwright local implementar o fluxo completo com os 10 passos. As alterações no sistema apenas melhoram o diagnóstico e evitam falsos positivos de sucesso.

