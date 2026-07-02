## Objetivo

Preparar o sistema e a documentação para gravação do screencast de App Review da Meta (permissões `whatsapp_business_messaging` e `whatsapp_business_management`). Como eu não posso gravar o vídeo por você (não tenho acesso ao seu login em produção, e vídeo gerado por IA é reprovado pela Meta), vou entregar tudo que reduz a gravação a apenas apertar REC.

## Entregáveis

### 1. Campo "Consentimento WhatsApp" no cadastro do cliente

**Backend (migration):**
- Adicionar em `public.devedores` as colunas:
  - `whatsapp_opt_in` boolean default false
  - `whatsapp_opt_in_em` timestamptz
  - `whatsapp_opt_in_origem` text (ex: "acordo_assinado", "portal_publico", "manual")
- Adicionar em `public.acordos` as mesmas 3 colunas (para consentimento amarrado à assinatura do acordo).
- Trigger: ao criar/ativar um acordo, marcar `whatsapp_opt_in = true` no devedor correspondente com origem `acordo_assinado`.

**Frontend:**
- Na página `DevedorDetalhe.tsx`, adicionar um card "Consentimento WhatsApp" mostrando:
  - Badge verde "Opt-in confirmado em DD/MM/YYYY HH:mm — origem: X" quando `whatsapp_opt_in = true`
  - Badge cinza "Sem consentimento registrado" quando falso, com botão "Registrar opt-in manualmente" (admin/gestor).
- Nas telas `EnvioMeta.tsx` e `InboxMeta.tsx`, mostrar o badge de opt-in próximo ao nome do cliente para o revisor da Meta ver que o consentimento é rastreado.

### 2. Texto "How to test" em inglês (arquivo entregável)

Gerar `/mnt/documents/meta-app-review-submission.md` contendo:
- Descrição em inglês de cada permissão (`whatsapp_business_messaging`, `whatsapp_business_management`) explicando exatamente para que o MEUS ACORDOS usa cada uma
- Credenciais de teste (você preenche antes de submeter)
- URL do sistema em produção
- URL da política de privacidade (`meusacordos.com.br/politica-privacidade`)
- URL de exclusão de dados
- Passo-a-passo em inglês que o revisor da Meta pode seguir
- Justificativa de negócio (recuperação de crédito com clientes que assinaram acordo de pagamento)
- Fluxo de opt-in documentado ("customer signs a payment agreement which includes explicit consent to receive WhatsApp payment reminders")

Entregue como `<presentation-artifact>` para download.

### 3. Cliente de teste "TESTE META REVIEW"

Passo manual no plano (não faço INSERT automático porque preciso do seu número real):
- Instrução para você criar via UI um devedor com nome "TESTE META REVIEW", CPF fictício válido (ex: 111.444.777-35), telefone do seu segundo celular, credor de teste
- Marcar `whatsapp_opt_in = true` via o novo botão manual
- Criar um acordo pequeno (R$ 100 em 1 parcela) para ter contexto real no vídeo

## Detalhes técnicos

**Migration:**
```sql
ALTER TABLE public.devedores
  ADD COLUMN whatsapp_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN whatsapp_opt_in_em timestamptz,
  ADD COLUMN whatsapp_opt_in_origem text;

ALTER TABLE public.acordos
  ADD COLUMN whatsapp_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN whatsapp_opt_in_em timestamptz,
  ADD COLUMN whatsapp_opt_in_origem text;

-- Trigger para propagar opt-in do acordo para o devedor
CREATE OR REPLACE FUNCTION public.propagar_opt_in_acordo() ...
```
Sem grants novos (tabelas já existem).

**Arquivos a editar:**
- `supabase/migrations/` — nova migration
- `src/pages/DevedorDetalhe.tsx` — card de consentimento
- `src/pages/EnvioMeta.tsx` — badge por linha
- `src/pages/InboxMeta.tsx` — badge no cabeçalho do chat

**Artefato gerado:**
- `/mnt/documents/meta-app-review-submission.md`

## Fora do escopo

- Gravação do vídeo em si (você faz com OBS/Loom seguindo os roteiros que já mandei na resposta anterior)
- Arquivo `.srt` de legendas e narração TTS (você indicou apenas 2 dos 4 entregáveis)
- Alteração no fluxo de assinatura pública do portal — o consentimento fica registrado apenas no momento da criação do acordo por enquanto

## Confirmação necessária

Aprove e eu executo tudo. Depois de aprovado eu já gero o markdown de submissão pronto para você colar no formulário da Meta.
