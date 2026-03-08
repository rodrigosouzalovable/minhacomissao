

# Fix: Chatbot não encontra dados do cliente enviado pelo Acionamento

## Diagnóstico

O problema é que o devedor "Rodrigo" (CPF 1867864339, telefone 62981865213, saldo R$ 2.500) **NÃO EXISTE na tabela `devedores`** do banco de dados. A planilha é lida apenas no navegador (client-side) pelo Acionamento e nunca é persistida no banco.

Quando o cliente responde "Sim":
1. O fromMe tracking tenta buscar o devedor pelo telefone → **não encontra** → não seta `proposta_enviada`
2. O chatbot reseta para `novo` → busca pelo telefone → **não encontra** → pede CPF
3. Cliente informa CPF → encontra JOSE CARLOS (outro devedor com mesmo CPF) → resposta errada

## Solução

Após enviar cada mensagem com sucesso pelo Acionamento, o sistema deve **salvar os dados do cliente na tabela `chatbot_conversas`** com o estado `proposta_enviada`, incluindo o saldo, nome, CPF e valores calculados. Assim, quando o cliente responder "Sim", o chatbot já terá todos os dados prontos.

### Mudanças

**1. `src/hooks/useAutoSend.tsx`** — Após envio bem-sucedido de uma mensagem que contém palavras de proposta ("50% de desconto", "parcelas em aberto"), chamar `supabase.from('chatbot_conversas').upsert(...)` com:
- `telefone` do cliente (formato limpo, sem formatação)
- `etapa: 'proposta_enviada'`
- `dados: { cpf, nome, valor_total: saldo, valor_avista: saldo*0.5, valor_parcelado: saldo*0.7, max_parcelas, credor, ... }`
- `server_url` e `instance_token` da instância que enviou

Isso é feito **no client-side**, logo após o envio com sucesso, usando o `saldo` que já está disponível no objeto `ClienteData`.

**2. `supabase/functions/whatsapp-chatbot/index.ts`** — No case `proposta_enviada`, se `dados.valor_avista` já existir, usar direto (já funciona hoje). Nenhuma mudança necessária aqui.

### Resultado
Quando a mensagem for enviada pelo Acionamento e o cliente responder "Sim", o chatbot já terá o estado correto (`proposta_enviada`) com o saldo (R$ 2.500) e responderá exatamente: "Que ótimo! Estamos com uma super oportunidade para você quitar todo débito em aberto pelo valor de R$ 1.250,00. Ou podemos parcelar para você em Xx de R$ XXX,XX. Como fica melhor para você?"

