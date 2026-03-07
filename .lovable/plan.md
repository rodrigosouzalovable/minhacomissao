

# Dar à IA do chat acesso às credenciais do CobMais

## Problema
Quando você pediu "coloque o login e a senha, caso você não saiba, me pergunte", a IA do chat **não sabe** quais são as credenciais — elas estão salvas na tabela `automacao_config` mas não são carregadas no contexto da IA. O agente no `server.js` recebe as credenciais corretamente (linhas 815-816 já fazem append no objetivo), mas a IA do chat não consegue:
1. Informar ao usuário quais credenciais serão usadas
2. Incluir as credenciais no objetivo enviado ao agente de forma explícita

Além disso, o agente pode ter ficado travado tentando decidir o que fazer sem ter clareza no objetivo.

## Solução

### `supabase/functions/chat-cobmais-knowledge/index.ts`

1. **Carregar credenciais do `automacao_config`** junto com sessions/knowledge no início da função
2. **Incluir no system prompt** uma seção informando à IA: "Você tem as credenciais CobMais configuradas: email=X. Quando o usuário pedir para fazer login, use a tool com objetivo claro como 'Fazer login com email X e senha Y'"
3. **Adicionar regra no prompt**: "Quando o usuário pedir para preencher login/senha, inclua as credenciais no objetivo da automação. Se não houver credenciais configuradas, peça ao usuário para configurá-las na seção de Configuração"

### Detalhes técnicos

```typescript
// Junto com sessions/knowledge fetch, adicionar:
const configRes = await adminClient.from("automacao_config")
  .select("cobmais_email, cobmais_senha")
  .order("criado_em", { ascending: false })
  .limit(1)
  .maybeSingle();

const cobmaisConfig = configRes.data;
```

No system prompt, adicionar seção:
```
## Credenciais CobMais:
${cobmaisConfig?.cobmais_email 
  ? `Email: ${cobmaisConfig.cobmais_email}, Senha: ${cobmaisConfig.cobmais_senha}. 
     Quando o usuário pedir para fazer login, use essas credenciais no objetivo.`
  : `NENHUMA CREDENCIAL CONFIGURADA. Peça ao usuário para configurar na seção "Configuração do Servidor".`}
```

Adicionar regra 20 no prompt:
```
20. Quando o usuário pedir para fazer login ou preencher credenciais, INCLUA email e senha no objetivo 
    da automação, ex: "Preencher o campo de email com X e o campo de senha com Y e clicar em Entrar"
```

Isso garante que:
- A IA sabe as credenciais e pode informar ao usuário
- O objetivo enviado ao agente é claro e específico
- Se não houver credenciais, a IA pede ao usuário

