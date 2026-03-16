

## Sugestoes de Melhoria do Sistema

Apos analise completa do codigo, identifiquei as seguintes sugestoes organizadas por prioridade:

---

### 1. Mensagem WhatsApp hardcoded com nome "Rodrigo" (Impacto alto)

**Arquivo:** `src/pages/Acordos.tsx` linha 24

A mensagem de confirmacao de acordo esta fixa com o nome "Rodrigo":
```
"Olá tudo bem {nome}? Meu nome é Rodrigo e sou do departamento de confirmação..."
```

**Sugestao:** Substituir pelo nome do operador logado (do perfil) para que cada funcionario envie com seu proprio nome. Buscar `profile.nome` e injetar na mensagem.

---

### 2. Dashboard usa useEffect + useState em vez de React Query (Consistencia)

**Arquivo:** `src/pages/Dashboard.tsx`

O Dashboard carrega dados com `useEffect` manual enquanto outras paginas usam `useQuery` do React Query. Isso significa:
- Sem cache automatico
- Sem refetch em foco de janela
- Sem estados de loading/error padronizados
- Dados nao sao compartilhados entre componentes

**Sugestao:** Migrar para `useQuery` para consistencia e melhor UX.

---

### 3. Acordos.tsx usa useEffect manual em vez de React Query (Performance)

**Arquivo:** `src/pages/Acordos.tsx` linhas 252-361

A pagina principal de acordos faz 4 queries separadas no `useEffect` sem cache. Cada navegacao recarrega tudo do zero.

**Sugestao:** Migrar para `useQuery` com `staleTime` adequado.

---

### 4. Envio WhatsApp em Acordos.tsx usa credenciais globais (Inconsistencia)

**Arquivo:** `src/pages/Acordos.tsx` linhas 224-232

O botao de WhatsApp na pagina de acordos chama `send-whatsapp` sem enviar `uazapi_server_url` / `uazapi_instance_token` do usuario. Isso significa que usa as credenciais globais do Deno.env em vez das instancias configuradas pelo usuario.

**Sugestao:** Buscar a instancia WhatsApp do usuario e enviar as credenciais na requisicao, similar ao que o PaymentReminders faz.

---

### 5. Uso excessivo de `as any` (Manutenibilidade)

**430 ocorrencias** espalhadas pelo codigo. Principais ofensores:
- `MetaPessoal.tsx` — tabela `metas_funcionarios` nao esta no tipo gerado
- `AcordoDevedorSection.tsx` — tabelas `acordos_devedor` e `parcelas_devedor`
- `ConsultaResultado.tsx` — RPCs tipadas incorretamente

**Sugestao:** Regenerar os tipos do banco (`supabase gen types`) para eliminar a necessidade de `as any` nas tabelas que ja existem.

---

### 6. Ausencia de paginacao na listagem de acordos

**Arquivo:** `src/pages/Acordos.tsx` linha 260

A query busca TODOS os acordos do usuario sem limite. Com o crescimento, isso causara lentidao.

**Sugestao:** Implementar paginacao ou infinite scroll com `.range()`.

---

### 7. Falta de confirmacao visual ao deletar acordo

**Arquivo:** `src/pages/Acordos.tsx` linhas 362-390

O `handleDelete` exclui pagamentos e acordo em sequencia, mas se a exclusao dos pagamentos falhar, o acordo permanece intacto porem sem feedback especifico. Nao ha transacao atomica.

**Sugestao:** Criar uma database function que delete pagamentos e acordo atomicamente.

---

### 8. Delay timer do WhatsAppSendingContext usa hack `as any`

**Arquivo:** `src/contexts/WhatsAppSendingContext.tsx` linhas 256-278

O timer e armazenado com `(delayResolveRef as any)._timer`, o que e fragil.

**Sugestao:** Usar um `useRef<NodeJS.Timeout>` separado para o timer.

---

### Resumo de Prioridades

| # | Sugestao | Esforco | Impacto |
|---|----------|---------|---------|
| 1 | Nome dinamico na mensagem WhatsApp | Baixo | Alto |
| 4 | Credenciais WhatsApp do usuario nos acordos | Medio | Alto |
| 6 | Paginacao de acordos | Medio | Alto |
| 7 | Delete atomico de acordo+pagamentos | Baixo | Medio |
| 2 | Dashboard com React Query | Medio | Medio |
| 3 | Acordos com React Query | Medio | Medio |
| 5 | Eliminar `as any` | Alto | Medio |
| 8 | Fix timer ref hack | Baixo | Baixo |

