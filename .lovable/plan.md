

# Plano: Personalizar Nome do Operador nas Mensagens de Lembrete

## Problema
As mensagens de lembrete estão hardcoded com "Meu nome é Rodrigo". Agora que outros operadores também enviam lembretes, a mensagem precisa usar o nome de cada um.

## Solução
Buscar o primeiro nome do operador da tabela `profiles` e usar na mensagem.

## Alteração

**Arquivo**: `supabase/functions/check-payment-reminders/index.ts`

### 1. Incluir `nome` no SELECT do profile (linha 106)
```typescript
.select('nome, whatsapp_lembretes_habilitado, whatsapp_lembrete_server_url, whatsapp_lembrete_instance_token')
```

### 2. Extrair primeiro nome e usar na mensagem (linhas 166-171)
```typescript
const primeiroNome = (profile.nome || 'Rodrigo').split(' ')[0];

if (tipoLembrete === 'dia_vencimento') {
  mensagem = `Olá ${acordo.cliente_nome} tudo bem? Meu nome é ${primeiroNome}, sou do departamento de acordos das Lojas Novo Mundo e estou passando para lembrar que o vencimento da sua parcela no valor de ${valorFormatado} vence *HOJE*. Gostaria que enviasse o boleto para pagamento?`;
} else {
  mensagem = `Olá ${acordo.cliente_nome} tudo bem? Meu nome é ${primeiroNome}, sou do departamento de acordos das Lojas Novo Mundo e estou passando para lembrar que o vencimento da sua parcela no valor de ${valorFormatado} vence dia ${dataFormatada}. Gostaria que enviasse o boleto para pagamento?`;
}
```

Fallback para "Rodrigo" caso o nome não esteja cadastrado.

