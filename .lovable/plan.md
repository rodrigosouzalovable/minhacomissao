

# Plano: Incluir Telefones do Cliente na Notificação de Consulta

## O que muda

**Arquivo**: `supabase/functions/notify-cpf-consulta/index.ts`

Na edge function, após receber o CPF, buscar os telefones cadastrados na tabela `devedor_telefones` e incluí-los na mensagem de notificação.

### Alterações:

1. Após criar o cliente Supabase, consultar `devedor_telefones` filtrando por `devedor_cpf` (normalizado)
2. Também buscar o telefone da tabela `devedores` como fallback
3. Formatar e adicionar uma linha `📞 *Telefone(s):*` na mensagem

**Resultado esperado:**

```
📋 *CONSULTA NO PORTAL*

📌 *CPF:* 022.961.612-78
👤 *Nome:* GEILSON LIMA DOS SANTOS
🏢 *Credor:* Novo Mundo
📊 *Débitos encontrados:* 19
📞 *Telefone(s):* (62) 99999-1234, (62) 98888-5678
🕐 *Data/Hora:* 09/03/2026, 10:21:43

_Portal de Acordos - Souza e Ribeiro_
```

Se não houver telefone cadastrado, exibe "Não cadastrado".

