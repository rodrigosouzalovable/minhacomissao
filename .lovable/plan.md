# Plano: Sistema mais leve e rápido

## Diagnóstico

O login está falhando com "O servidor demorou para responder" e a própria consulta de metadados do banco retornou **"Connection terminated due to connection timeout"**. Isso confirma que o backend (banco de dados Lovable Cloud) está saturado — não é mais um problema só de UI.

Identifiquei 4 fontes principais de sobrecarga:

1. **Realtime barulhento no badge do Inbox** (`AppLayout.tsx`): inscreve em TODAS as mudanças da tabela `whatsapp_contatos` (qualquer usuário, qualquer instância) e dispara um `COUNT(*)` no banco a cada evento. Com tráfego de WhatsApp ativo, isso pode gerar centenas de queries por minuto por aba aberta.
2. **Lembretes de pagamento pesados para admin** (`usePaymentReminders.tsx`): 3 queries com JOIN em `pagamentos`+`acordos` SEM filtro por `user_id` quando é admin, mais uma 4ª query em `pagamentos` para deduplicar. Roda a cada 5 min em todas as abas.
3. **Falta de índices** nas colunas mais consultadas (`pagamentos.status+data_prevista`, `acordos.user_id`, `whatsapp_contatos.instancia_id+nao_lido+arquivado`, `retornos.status+data_retorno`).
4. **Sem timeout no login**: a tela de auth fica travada esperando indefinidamente quando o backend está lento.

## O que vou fazer

### 1. Aliviar o backend imediatamente (maior impacto)
- **Badge do Inbox**: remover o realtime global. Substituir por um refresh leve a cada 2 minutos + atualização sob demanda quando o usuário abre o Inbox. Isso elimina dezenas de queries/minuto.
- **Lembretes de pagamento (sino)**:
  - Aumentar `refetchInterval` de 5min para 10min.
  - Selecionar apenas as colunas necessárias (remover JOIN gordo, usar `select` mínimo).
  - Para admin, limitar resultado a no máximo 500 itens (`limit(500)`) — o sino não precisa carregar o sistema inteiro.
  - Combinar a query de "hoje + 3 dias" com a de "vencidas" em uma única chamada (1 query em vez de 3).
- **Login com timeout e mensagem clara**: adicionar `Promise.race` de 12s no `signIn` da página `/auth` com mensagem orientando a tentar novamente.

### 2. Índices de performance no banco
Criar (com `CREATE INDEX CONCURRENTLY` para não travar):
- `pagamentos (status, data_prevista)`
- `pagamentos (acordo_id, status)`
- `acordos (user_id, status)`
- `whatsapp_contatos (instancia_id, arquivado, nao_lido)`
- `retornos (user_id, status, data_retorno)`
- `lembretes_lidos (user_id, criado_em)`

### 3. Recomendação de upgrade do Lovable Cloud
Com base nos sintomas (timeouts até em metadados), o tamanho atual da instância está no limite. Após aplicar as otimizações acima, recomendo aumentar o tamanho da instância em **Cloud → Advanced settings → Upgrade instance**. Isso libera CPU/IO do Postgres e elimina a raiz do problema de "o servidor demorou para responder". Vou avisar no final, com link da documentação — você decide se quer subir o tamanho (impacta o consumo do Cloud).

## O que NÃO vou fazer
- Não vou criar novos cron jobs (você já pediu para não aumentar consumo).
- Não vou refatorar páginas inteiras (Acionamento, Importar) agora — foco no que destrava o login e o carregamento global.
- Não vou tocar em fluxo de autenticação além do timeout/UX.

## Detalhes técnicos

**Arquivos a alterar:**
- `src/components/layout/AppLayout.tsx` — remover canal realtime, usar polling de 2min + revalidação no foco.
- `src/hooks/usePaymentReminders.tsx` — unificar queries hoje/3d/vencidas, `limit(500)`, intervalo 10min, `select` enxuto.
- `src/pages/Auth.tsx` (ou equivalente) — `Promise.race` de 12s no login + toast com instrução de retry.
- Nova migração SQL com os 6 índices `CONCURRENTLY` listados acima.

**Snippet do login com timeout:**
```ts
const result = await Promise.race([
  supabase.auth.signInWithPassword({ email, password }),
  new Promise<never>((_, rej) =>
    setTimeout(() => rej(new Error('timeout')), 12000)
  ),
]);
```

**Snippet do badge do Inbox (sem realtime):**
```ts
useEffect(() => {
  fetchUnreadCount();
  const id = setInterval(fetchUnreadCount, 120_000); // 2 min
  const onFocus = () => fetchUnreadCount();
  window.addEventListener('focus', onFocus);
  return () => { clearInterval(id); window.removeEventListener('focus', onFocus); };
}, [fetchUnreadCount]);
```

## Aviso de custo
Nenhuma das mudanças de código aumenta consumo — pelo contrário, **reduz** queries e execuções. A única ação que pode aumentar custo é o upgrade de instância no Cloud, e isso fica como recomendação opcional para você decidir depois de ver o efeito das otimizações.

Posso aplicar?