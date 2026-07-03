
## 1. Respostas às suas 3 perguntas (contexto, não é código)

### a) "Meus templates são utility, por que estou pagando tanto?"
Confirmei no banco: `informacoes_sobre_seu_debito` e `segurana_do_processo` estão como **UTILITY / approved**. O problema não é a nossa classificação — é como a Meta cobra hoje (modelo per‑message a partir de jul/2025):

| Categoria | Custo aproximado (BR) | Grátis? |
|---|---|---|
| Utility dentro da janela de atendimento (cliente respondeu nas últimas 24h) | US$ 0 | **Sim** |
| Utility fora da janela (envio "frio") | ~US$ 0,008/msg | Não |
| Marketing | ~US$ 0,0625/msg | Não |
| Service (resposta manual dentro de 24h) | US$ 0 | **Sim** |

Ou seja: se você mandar 400 templates utility para clientes que **não** te responderam nas últimas 24h, custa ~US$ 3,20. Mas a Meta pode **reclassificar** um template no ato de enviar se o conteúdo tiver aparência promocional — nesse caso cobra como marketing sem avisar. Um dos templates precisa ser auditado (o texto será verificado quando implementarmos a trava).

Além disso, a recarga de US$ 25 de hoje inclui saldo devedor acumulado de dias anteriores que ainda não tinham sido cobrados — não é o custo só de hoje.

### b) "E se eu responder o cliente pelo celular físico onde o número está conectado?"
Importante: um número que está **na API Oficial (Cloud API) da Meta não pode estar logado ao mesmo tempo no app WhatsApp normal**. Ao migrar para a API, o app é deslogado. Se você está conseguindo responder pelo app, é porque:
- ou é **outro número** (não o da API), respondendo o mesmo cliente por outra linha;
- ou o número ainda **não foi totalmente migrado** para a Cloud API.

Consequência para a cobrança:
- Mensagens enviadas pelo **app** não passam pela Meta Cloud API e **não são cobradas** por conversa/msg da API — mas também não abrem "janela de serviço grátis" do lado da API. Não contam como marketing.
- Mensagens enviadas pela **API** (nossa Inbox Meta): se estiverem dentro de 24h após o cliente ter escrito, são **grátis** (janela de serviço). Fora disso, exigem template — e aí conta segundo a categoria do template.

Resumo: usar o app não vira "marketing" na fatura Meta. O que vira marketing é usar um template categoria MARKETING na API, ou a Meta reclassificar um utility com conteúdo promocional.

### c) Por que a janela de 24h aparece dentro do sistema?
É uma regra da Meta, não escolha nossa. A Cloud API só permite mensagem de texto livre para o cliente se ele mandou algo pra você nas últimas 24h. Passou disso, só template. Por isso a Inbox Meta mostra o contador de janela.

---

## 2. O que vou construir (código)

### A) Trava de segurança "Só Utility" (bloqueio duro)

Aplicar em **todos os pontos** onde o sistema chama `send-whatsapp-meta-template` (Envio Meta Massa, disparos automáticos, Inbox, Central de Lembretes, cron jobs):

1. Antes de enviar, buscar em `meta_whatsapp_templates` a `categoria` do template escolhido.
2. Se `categoria = 'MARKETING'`:
   - **Bloquear o envio** (não chama a Meta).
   - Registrar o bloqueio em `admin_notificacoes_log` e disparar notificação no WhatsApp do admin (62991672674) com: template, quantidade que seria enviada, quem tentou disparar, timestamp.
   - Retornar erro claro no toast: "Envio bloqueado: template categoria MARKETING. Use apenas templates UTILITY. Admin foi notificado."
3. Se `categoria = 'UTILITY'` ou `'AUTHENTICATION'`: segue normal.
4. Se `categoria = 'MARKETING'` mas o admin quiser liberar caso a caso: um botão "Solicitar liberação temporária" que registra pedido pendente; admin libera pela UI (24h de validade).

**Configuração**: nova tabela `meta_billing_guardrail` com colunas `bloquear_marketing bool` (default true), `notificar_telefone text`, `limite_diario_usd numeric` (soft cap opcional), `atualizado_em`, `atualizado_por`. RLS admin-only + GRANTs padrão.

### B) Alerta antes do envio quando a Meta reclassificar utility → marketing

A Meta pode reclassificar no momento do envio (retorna erro `131050` ou similar, ou aceita mas registra como marketing). Como não temos webhook de reclassificação em tempo real, faço duas defesas:

1. **Sync mais frequente da categoria** dos templates aprovados: hoje `sincronizado_em` é manual. Adiciono cron `sync-meta-templates-categoria` (a cada 6h) que puxa `GET /message_templates` de cada instância e atualiza `categoria`. Se um template mudar de UTILITY para MARKETING, dispara notificação imediata no WhatsApp do admin com "⚠️ Template X foi reclassificado pela Meta para MARKETING. Está bloqueado a partir de agora."

2. **Confirmação visual no Envio Meta Massa**: já que hoje o painel mostra as instâncias vinculadas a cada template, adicionar badge **"UTILITY ✓"** ou **"MARKETING ✗ bloqueado"** ao lado de cada template no dropdown, com cor (verde/vermelho). Se todos os templates de uma instância forem marketing → dropdown mostra vazio com aviso.

### C) Painel "Custo Meta Estimado" (informativo, mesma página do Envio Meta Massa)

Card no topo mostrando (últimos 7 dias):
- Templates enviados por categoria
- Estimativa em US$ (utility fora da janela × US$ 0,008 + marketing × US$ 0,0625; utility dentro da janela = 0)
- Conversão para BRL usando a taxa fixa configurável (default 5,60)
- Aviso amarelo se estimativa semanal > US$ 15
- Aviso vermelho se > US$ 22 (recarga próxima)

Fonte: `meta_whatsapp_envios_log` × `meta_whatsapp_templates.categoria` + verificação de janela via `meta_whatsapp_mensagens` (última mensagem entrada do cliente ≤ 24h antes do envio).

### D) Notificação de recarga automática iminente
Cron diário 19:00 BRT: soma custo estimado dos últimos 7 dias. Se ≥ US$ 20 acumulados desde o último "reset", manda WhatsApp para o admin: "⚠️ Meta pode debitar US$ 25 nas próximas 24h. Consumo estimado: US$ X".

---

## 3. Detalhes técnicos

**Arquivos novos**
- `supabase/migrations/*` — cria `meta_billing_guardrail` (1 linha singleton) e `meta_template_reclassificacoes` (log de mudanças de categoria detectadas).
- `supabase/functions/sync-meta-templates-categoria/index.ts` — cron 6h.
- `supabase/functions/meta-billing-alerta-diario/index.ts` — cron 19h.
- `src/components/meta/MetaCustoEstimadoCard.tsx` — card de custo estimado no Envio Meta Massa.
- `src/components/meta/MetaGuardrailConfig.tsx` — UI admin em Configurar Meta para editar guardrail (default: bloquear marketing = ON).

**Arquivos alterados**
- `supabase/functions/send-whatsapp-meta-template/index.ts` — checar categoria antes de enviar, bloquear se MARKETING.
- `supabase/functions/send-whatsapp-meta-massa/index.ts` (ou equivalente) — mesma checagem, aborta lote inteiro.
- `src/pages/EnvioMeta.tsx` — badge de categoria + card de custo estimado no topo.
- `src/pages/ConfigurarMeta.tsx` — seção "Segurança de Custos" com toggle "Bloquear MARKETING" (ON por default) e edição de `limite_diario_usd`.

**Fora de escopo**
- Não vou mexer no aquecimento, na Inbox comum (não-Meta), nem nas rotinas de cobrança WhatsApp/UAZAPI.
- Não vou tentar impedir você de responder pelo app do celular — isso não passa pelo nosso sistema.
- Não vou mudar categoria de template no lado da Meta (isso só é feito no Business Manager da Meta).

---

## 4. Ordem de implementação sugerida
1. Migração + guardrail default ligado
2. Bloqueio de MARKETING no `send-whatsapp-meta-template`
3. Badge de categoria no Envio Meta Massa + card de custo estimado
4. Cron de sync de categoria + alerta de reclassificação
5. Cron diário de alerta de recarga

Se aprovar, começo por 1–3 (o que já mata 90% do risco) e depois 4–5.
