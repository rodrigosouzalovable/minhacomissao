## Análise de viabilidade

### Onde o telefone é usado hoje como identificador
- **Tabelas Meta**: `meta_whatsapp_contatos.telefone`, `meta_whatsapp_mensagens.telefone`, `meta_whatsapp_envios_log.telefone` — todas indexadas/filtradas por telefone (E.164 sem `+`, prefixo 55).
- **Webhook `meta-whatsapp-webhook`**: casa contato pelo **sufixo dos últimos 8 dígitos** do telefone (memória: phone-suffix-matching-standard). Todo o unificador de duplicados depende disso.
- **Envios (`send-whatsapp-meta`, `-text`, `-media`)**: usam `to: <telefone>` e a chave `(instancia_id, telefone)` para upsert do contato e checagem da janela 24h.
- **Domínio de negócio (não-Meta)**: `acordos.cliente_cpf`, `devedores.cpf`, `whatsapp_contatos.telefone` (UAZAPI). Match cliente↔webhook Meta é feito por telefone-sufixo → CPF via tabelas do sistema.

### Impacto real
| Área | Impacto | Risco |
|---|---|---|
| Webhook Meta | Precisa ler `contact.userId` + `contact.username` e persistir | Alto — sem isso, cliente sem telefone vira contato "fantasma" |
| Inbox Meta (UI) | Precisa exibir username + identificar conversa por BSUID quando não houver tel | Médio |
| Envio unitário (janela 24h) | Precisa aceitar BSUID como `to` | Alto |
| Envio em massa (templates) | Continua por telefone (base histórica tem tel); BSUID só p/ resposta em janela | Baixo |
| Templates de autenticação | Meta proíbe envio via BSUID — bloquear no UI | Baixo |
| Match com acordo/devedor (CPF) | Precisa correlacionar BSUID↔telefone histórico; guardar BSUID no contato Meta | Alto |
| UAZAPI (aba Robô) | Não afetada agora — WhatsApp Business API oficial é o único caminho com BSUID | — |

**Viabilidade: alta.** A migração é aditiva (novas colunas, sem quebrar schema). Contatos existentes continuam válidos por telefone; BSUID é preenchido conforme os webhooks chegarem.

## Respostas às perguntas específicas

1. **Identificador primário hoje**: telefone E.164 (com prefixo 55, sem `+`). `phone_number_id` é o número **da empresa**, salvo em `meta_whatsapp_instances`, não do cliente.
2. **Match webhook↔cadastro**: só por sufixo dos últimos 8 dígitos do telefone. Não há hoje nenhum identificador do cliente por Business Manager.
3. **Mensagens automáticas (lembretes)**: são disparadas a partir de `acordos.cliente_telefone` / `devedores.telefone`. Enquanto o cliente tiver telefone salvo, seguem funcionando. Só clientes que **iniciarem contato já como username-only** precisarão de envio via BSUID (dentro da janela 24h). Templates HSM continuam exigindo telefone.
4. **Tabela de clientes com id exclusivo por Business Manager**: não existe. Vamos criar via coluna `bsuid` em `meta_whatsapp_contatos` (BSUID é escopado por WABA, então por instância).

## Plano de implementação — 4 fases

### Fase 1 — Persistir BSUID e username (2 dias)

**Migração SQL** (aditiva, sem quebrar nada):

```sql
ALTER TABLE public.meta_whatsapp_contatos
  ADD COLUMN bsuid text,
  ADD COLUMN whatsapp_username text,
  ADD COLUMN ultima_interacao_em timestamptz,
  ADD COLUMN telefone_visivel boolean NOT NULL DEFAULT true;

CREATE INDEX idx_meta_contatos_bsuid ON public.meta_whatsapp_contatos(instancia_id, bsuid)
  WHERE bsuid IS NOT NULL;
CREATE INDEX idx_meta_contatos_username ON public.meta_whatsapp_contatos(instancia_id, whatsapp_username)
  WHERE whatsapp_username IS NOT NULL;

ALTER TABLE public.meta_whatsapp_mensagens ADD COLUMN bsuid text;
ALTER TABLE public.meta_whatsapp_envios_log ADD COLUMN bsuid text;
```

**Edge function `meta-whatsapp-webhook`**:
- Extrair `contact.userId` (BSUID) e `contact.username` de cada `messages[].contacts[]`.
- Ao criar/atualizar contato: `upsert` por `(instancia_id, bsuid)` quando BSUID existir; senão fallback para `(instancia_id, telefone)`.
- Se telefone vier vazio mas BSUID existir, gravar `telefone_visivel=false` e usar BSUID como chave lógica no `telefone` (prefixado, ex: `bsuid:BR.13491...`) **ou** manter `telefone=NULL` e novo campo `identificador_display`. Escolha recomendada: **manter telefone NULL** e adicionar view/hook que devolve `telefone ?? bsuid`.
- Atualizar `ultima_interacao_em = now()` a cada mensagem entrada — controla janela 24h (Meta) e janela 30d (visibilidade do telefone).
- Se o mesmo BSUID chegar com telefone novo, atualizar telefone; se telefone existente chegar com BSUID novo, atualizar BSUID (Meta emite webhook de mudança).

### Fase 2 — Envio compatível com BSUID (2 dias)

- `send-whatsapp-meta-text` e `send-whatsapp-meta-media`: aceitar `bsuid` opcional no body. Se `bsuid` presente e `telefone` ausente → `body.to = bsuid`. Manter validação de janela 24h por BSUID (usando `meta_whatsapp_contatos.ultima_interacao_em`).
- `send-whatsapp-meta` (templates HSM): **continua exigindo telefone**. Bloquear no UI (Envio Meta Massa) qualquer contato sem telefone. Templates de categoria `AUTHENTICATION` já são bloqueados p/ BSUID pela Meta — adicionar check no envio 1:1 também.
- Inbox Meta (`MetaComposer`, `InboxMeta.tsx`): passar `bsuid` do contato ao chamar as funções de envio.

### Fase 3 — Correlação com cadastro existente (2 dias)

- Ao receber webhook com BSUID + telefone: procurar `acordos`/`devedores` por sufixo telefone, e gravar BSUID no contato Meta. Contato Meta vira ponte BSUID↔CPF.
- Ao receber webhook com **só BSUID** (username-only, sem telefone): tentar match por BSUID existente. Se novo, criar contato Meta órfão e exibir na Inbox com badge "sem telefone" — operador vincula manualmente ao CPF quando o cliente se identificar na conversa.
- **Contact Book da Meta**: opcional; adiar para depois da Fase 4. Requer chamadas periódicas à Graph API para reenviar catálogo de números conhecidos e manter visibilidade do telefone. Só compensa se muitos clientes migrarem p/ username.

### Fase 4 — UI e validação (2 dias)

- Inbox Meta: coluna/campo mostrando `@username` quando existir; badge "só BSUID" quando `telefone_visivel=false`.
- Envio Meta Massa: filtrar contatos sem telefone quando o template exigir telefone (todos hoje).
- Testes: uma instância Meta de teste + número que adota username; validar recebimento, resposta, envio 24h por BSUID, e correlação com CPF existente.
- Log de auditoria: contar quantos contatos vieram só com BSUID / só telefone / ambos, para acompanhar migração.

## Cronograma

```text
Semana 1 (5 dias úteis)
  Seg-Ter  Fase 1: migração + webhook
  Qua-Qui  Fase 2: envios com BSUID
  Sex      Fase 3 (início): correlação BSUID↔CPF

Semana 2 (3 dias úteis)
  Seg      Fase 3 (fim): fluxo de contato órfão
  Ter-Qua  Fase 4: UI + testes com número real

Total: 8 dias úteis. Folga confortável antes de jun/2026.
```

Dependências: acesso a uma conta Meta WABA de teste com username habilitado (Meta libera por fase).

## Fora do escopo desta primeira entrega
- Contact Book API (Fase 5 futura, só se necessário).
- Migração da aba **Robô UAZAPI** — a UAZAPI ainda não expõe BSUID; aguardar SDK do parceiro.
- Alteração de schema em `acordos`/`devedores` (BSUID fica no contato Meta, não no domínio de acordos).

## Custos Lovable Cloud
Apenas 4 colunas + 2 índices + updates nos webhooks existentes. Sem novas funções agendadas, sem storage extra. Impacto de custo desprezível.

## Próximo passo
Se aprovar, começo pela Fase 1 (migração + webhook) já no próximo turno.
