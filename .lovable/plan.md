

# Fluxo humanizado: confirmar CPF + proposta curta e direta

## Problema atual
1. Quando o chatbot encontra o devedor pelo telefone, ele pula direto para a proposta sem confirmar CPF
2. A proposta gerada pela IA é longa demais — parece robô, não humano
3. Falta mencionar o credor (ex: "Lojas Novo Mundo") na proposta

## Novo fluxo

```text
Cliente responde "Sim, como fica" →
  Chatbot encontra devedor pelo telefone →
    "Só pra confirmar, seu CPF é 018.678.643-39?" →
      Cliente confirma →
        "Perfeito, Jose! A proposta para pagamento à vista é *R$ 714,80*,
         pagando esse valor você quita todas as parcelas com as Lojas Novo Mundo.
         Ou podemos parcelar: *5x de R$ 200,14*. Como fica melhor pra você?"
```

## Mudanças em `supabase/functions/whatsapp-chatbot/index.ts`

### 1. Case `novo` — quando devedor único encontrado por telefone
Em vez de ir direto para a proposta, o chatbot:
- Busca o CPF e nome do devedor
- Envia mensagem curta: "Só pra confirmar, seu CPF é XXX.XXX.XXX-XX?"
- Salva os dados e muda etapa para `aguardando_confirmacao_identidade`

### 2. Case `aguardando_confirmacao_identidade` — após confirmação
- Consulta débitos via `consultar_debitos_por_cpf`
- Busca o campo `credor` da tabela `devedores` para usar na mensagem
- Gera proposta CURTA e direta no estilo:
  > "Perfeito, {primeiro_nome}! A proposta disponível para *pagamento à vista é {valor_avista}*, pagando esse valor, você quita todas as parcelas em aberto com {credor}. Ou podemos parcelar para o senhor da seguinte forma: *{maxParcelas}x de {valorParcela}*. Como fica melhor para você?"
- Instrução explícita à IA no prompt para ser breve (2-3 frases), sem enumerar opções, sem emojis excessivos

### 3. Prompt da IA ajustado
O contexto enviado à IA terá instruções mais rígidas:
- Máximo 3 frases
- Não usar numeração (1, 2)
- Tom conversacional como se estivesse no WhatsApp de verdade
- Incluir o nome do credor na mensagem
- Usar apenas o primeiro nome do cliente

### 4. Incluir `credor` na consulta de devedores
Adicionar `credor` ao `select` das queries de devedores e ao `consultar_debitos_por_cpf` (que já retorna os dados necessários — o campo `credor` será buscado separadamente na tabela `devedores`).

