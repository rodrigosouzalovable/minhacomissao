
DO $$ BEGIN
  CREATE TYPE public.consultoria_status AS ENUM ('nao_iniciado','em_andamento','concluido');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.consultoria_material_tipo AS ENUM ('pdf','planilha','checklist','video','link');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.consultoria_duvida_status AS ENUM ('pendente','respondida');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.consultoria_alunos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  email text NOT NULL,
  empresa text,
  telefone text,
  ativo boolean NOT NULL DEFAULT true,
  is_admin_consultoria boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultoria_alunos TO authenticated;
GRANT ALL ON public.consultoria_alunos TO service_role;
ALTER TABLE public.consultoria_alunos ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_consultoria_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND (
    public.is_admin_user(_uid)
    OR EXISTS (SELECT 1 FROM public.consultoria_alunos WHERE user_id = _uid AND is_admin_consultoria = true AND ativo = true)
  )
$$;

CREATE OR REPLACE FUNCTION public.is_consultoria_aluno(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.consultoria_alunos WHERE user_id = _uid AND ativo = true
  )
$$;

CREATE POLICY "aluno vê seu registro" ON public.consultoria_alunos
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_consultoria_admin(auth.uid()));
CREATE POLICY "admin gerencia alunos" ON public.consultoria_alunos
  FOR ALL TO authenticated
  USING (public.is_consultoria_admin(auth.uid()))
  WITH CHECK (public.is_consultoria_admin(auth.uid()));

CREATE TABLE public.consultoria_modulos (
  id int PRIMARY KEY,
  titulo text NOT NULL,
  descricao text,
  duracao text,
  ordem int NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultoria_modulos TO authenticated;
GRANT ALL ON public.consultoria_modulos TO service_role;
ALTER TABLE public.consultoria_modulos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aluno lê módulos" ON public.consultoria_modulos
  FOR SELECT TO authenticated
  USING (public.is_consultoria_aluno(auth.uid()) OR public.is_consultoria_admin(auth.uid()));
CREATE POLICY "admin gerencia módulos" ON public.consultoria_modulos
  FOR ALL TO authenticated
  USING (public.is_consultoria_admin(auth.uid()))
  WITH CHECK (public.is_consultoria_admin(auth.uid()));

CREATE TABLE public.consultoria_aulas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo_id int NOT NULL REFERENCES public.consultoria_modulos(id) ON DELETE CASCADE,
  numero int NOT NULL,
  titulo text NOT NULL,
  conteudo_md text NOT NULL DEFAULT '',
  video_url text,
  ordem int NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (modulo_id, numero)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultoria_aulas TO authenticated;
GRANT ALL ON public.consultoria_aulas TO service_role;
ALTER TABLE public.consultoria_aulas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aluno lê aulas" ON public.consultoria_aulas
  FOR SELECT TO authenticated
  USING (public.is_consultoria_aluno(auth.uid()) OR public.is_consultoria_admin(auth.uid()));
CREATE POLICY "admin gerencia aulas" ON public.consultoria_aulas
  FOR ALL TO authenticated
  USING (public.is_consultoria_admin(auth.uid()))
  WITH CHECK (public.is_consultoria_admin(auth.uid()));

CREATE TABLE public.consultoria_materiais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo_id int REFERENCES public.consultoria_modulos(id) ON DELETE CASCADE,
  aula_id uuid REFERENCES public.consultoria_aulas(id) ON DELETE CASCADE,
  tipo public.consultoria_material_tipo NOT NULL,
  nome text NOT NULL,
  descricao text,
  storage_path text,
  url_externa text,
  ordem int NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultoria_materiais TO authenticated;
GRANT ALL ON public.consultoria_materiais TO service_role;
ALTER TABLE public.consultoria_materiais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aluno lê materiais" ON public.consultoria_materiais
  FOR SELECT TO authenticated
  USING (public.is_consultoria_aluno(auth.uid()) OR public.is_consultoria_admin(auth.uid()));
CREATE POLICY "admin gerencia materiais" ON public.consultoria_materiais
  FOR ALL TO authenticated
  USING (public.is_consultoria_admin(auth.uid()))
  WITH CHECK (public.is_consultoria_admin(auth.uid()));

CREATE TABLE public.consultoria_progresso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.consultoria_alunos(id) ON DELETE CASCADE,
  aula_id uuid NOT NULL REFERENCES public.consultoria_aulas(id) ON DELETE CASCADE,
  status public.consultoria_status NOT NULL DEFAULT 'nao_iniciado',
  progresso int NOT NULL DEFAULT 0,
  data_inicio timestamptz,
  data_conclusao timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (aluno_id, aula_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultoria_progresso TO authenticated;
GRANT ALL ON public.consultoria_progresso TO service_role;
ALTER TABLE public.consultoria_progresso ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aluno gerencia seu progresso" ON public.consultoria_progresso
  FOR ALL TO authenticated
  USING (
    aluno_id IN (SELECT id FROM public.consultoria_alunos WHERE user_id = auth.uid())
    OR public.is_consultoria_admin(auth.uid())
  )
  WITH CHECK (
    aluno_id IN (SELECT id FROM public.consultoria_alunos WHERE user_id = auth.uid())
    OR public.is_consultoria_admin(auth.uid())
  );

CREATE TABLE public.consultoria_duvidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.consultoria_alunos(id) ON DELETE CASCADE,
  modulo_id int REFERENCES public.consultoria_modulos(id) ON DELETE SET NULL,
  aula_id uuid REFERENCES public.consultoria_aulas(id) ON DELETE SET NULL,
  pergunta text NOT NULL,
  resposta text,
  status public.consultoria_duvida_status NOT NULL DEFAULT 'pendente',
  respondido_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  respondido_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultoria_duvidas TO authenticated;
GRANT ALL ON public.consultoria_duvidas TO service_role;
ALTER TABLE public.consultoria_duvidas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aluno vê suas dúvidas" ON public.consultoria_duvidas
  FOR SELECT TO authenticated
  USING (
    aluno_id IN (SELECT id FROM public.consultoria_alunos WHERE user_id = auth.uid())
    OR public.is_consultoria_admin(auth.uid())
  );
CREATE POLICY "aluno cria dúvida" ON public.consultoria_duvidas
  FOR INSERT TO authenticated
  WITH CHECK (aluno_id IN (SELECT id FROM public.consultoria_alunos WHERE user_id = auth.uid()));
CREATE POLICY "admin responde dúvida" ON public.consultoria_duvidas
  FOR UPDATE TO authenticated
  USING (public.is_consultoria_admin(auth.uid()))
  WITH CHECK (public.is_consultoria_admin(auth.uid()));
CREATE POLICY "admin deleta dúvida" ON public.consultoria_duvidas
  FOR DELETE TO authenticated
  USING (public.is_consultoria_admin(auth.uid()));

CREATE TRIGGER trg_consultoria_alunos_upd BEFORE UPDATE ON public.consultoria_alunos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_consultoria_modulos_upd BEFORE UPDATE ON public.consultoria_modulos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_consultoria_aulas_upd BEFORE UPDATE ON public.consultoria_aulas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_consultoria_materiais_upd BEFORE UPDATE ON public.consultoria_materiais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_consultoria_progresso_upd BEFORE UPDATE ON public.consultoria_progresso
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_consultoria_duvidas_upd BEFORE UPDATE ON public.consultoria_duvidas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.consultoria_modulos (id, titulo, descricao, duracao, ordem) VALUES
(1,'Fundamentos da API Oficial','Entenda o que é a API do WhatsApp Business, como funciona a cobrança, a estrutura da Meta e os tipos de mensagem.','2h',1),
(2,'Configuração da Conta e Segurança','Configure Business Manager, WABA, números, webhooks e tokens com boas práticas de segurança.','2h',2),
(3,'Modelos de Mensagem e Aprovação','Aprenda a criar templates aprovados pela Meta, evitar rejeições e gerenciar em múltiplos números.','2h',3),
(4,'Envio e Monitoramento','Envie mensagens via API, monitore entregas, qualidade e mantenha a reputação alta.','2h',4),
(5,'Resolução de Problemas e Recuperação','Diagnostique erros, recupere números banidos, faça appeals e aumente seus tiers.','1,5h',5);

INSERT INTO public.consultoria_aulas (modulo_id, numero, titulo, ordem, conteudo_md) VALUES
(1,1,'O que é a API do WhatsApp Business (Cloud API vs On-Premise)',1,
$md$# O que é a API do WhatsApp Business

A **API do WhatsApp Business** é a solução oficial da Meta para empresas que precisam se comunicar com clientes em escala. Diferente do app WhatsApp Business (manual), a API permite integração com sistemas, envio automatizado e gerenciamento de múltiplos números.

## Cloud API vs On-Premise

| Característica | Cloud API | On-Premise |
|---|---|---|
| Hospedagem | Meta hospeda | Você hospeda |
| Custo de infra | Zero | Servidor próprio |
| Atualizações | Automáticas | Manuais |
| Recomendação atual | ✅ Cloud API | Descontinuada em 2025 |

## Vantagens

- Envio em massa dentro dos limites da Meta
- Templates aprovados (HSM) para mensagens fora de janela
- Webhooks para status de entrega, leitura e respostas
- Múltiplos números por conta

## Requisitos para começar

- Conta Business Manager verificada
- WABA (WhatsApp Business Account)
- Número de telefone dedicado
- Método de pagamento configurado
$md$),
(1,2,'Como funciona a cobrança (conversas, mensagens, thresholds)',2,
$md$# Cobrança da API

Desde 2025 a Meta mudou para **cobrança por mensagem template**, exceto Utility e Service em janela de atendimento.

## Categorias

- **Marketing**: cobrada por template enviado
- **Utility**: cobrada por template; grátis dentro da janela de 24h iniciada pelo cliente
- **Authentication**: cobrada por template
- **Service**: grátis dentro da janela de 24h

## Como reduzir custos

1. Priorize Utility em vez de Marketing quando possível
2. Aproveite a janela de 24h para respostas gratuitas
3. Consolide notificações
4. Monitore relatórios de billing semanalmente
$md$),
(1,3,'Estrutura da Meta (WABA, Business Manager, Portfólio)',3,
$md$# Estrutura da Meta

```
Portfólio (Meta Business Portfolio)
 └── Business Manager (BM)
       └── WABA (WhatsApp Business Account)
             └── Número (Phone Number ID)
                   └── Templates
```

## Limites

- 1 BM comporta **até 20 números** ativos na API
- 1 WABA pode ter múltiplos números
- 1 número pertence a apenas 1 WABA

## Recomendação

Se você tem mais de 20 números, precisa de múltiplas BMs. Organize por segmento (ex: BM Cobrança, BM Vendas).
$md$),
(1,4,'Modelos de mensagem (Utility, Marketing, Authentication)',4,
$md$# Categorias de Template

## Utility
Notificações transacionais: confirmação de pedido, atualização de status, cobrança de boleto emitido.

## Marketing
Promoções, ofertas, campanhas de reativação. Mais caras.

## Authentication
Códigos OTP, verificação 2FA. Formato restrito.

⚠️ Categorizar errado é o principal motivo de downgrade de tier.
$md$),
(1,5,'Limites de envio (Tiers, escalonamento, reputação)',5,
$md$# Tiers de mensageria

| Tier | Destinatários únicos / 24h |
|---|---|
| Unverified | 250 |
| Tier 1K | 1.000 |
| Tier 10K | 10.000 |
| Tier 100K | 100.000 |
| Unlimited | Ilimitado |

## Como subir de tier

1. Quality rating **High** por 7 dias consecutivos
2. Volume próximo do teto do tier atual
3. Baixo bloqueio (< 1%)

## Reputação

🟢 High | 🟡 Medium | 🔴 Low

Cair para Low pode congelar o número por 24-72h.
$md$),

(2,1,'Como configurar um Business Manager do zero',1,
$md$# Configurando um Business Manager

1. Acesse [business.facebook.com](https://business.facebook.com)
2. Criar Portfólio com dados reais (CNPJ)
3. Adicione página do Facebook (obrigatória)
4. Método de pagamento em Configurações → Pagamentos
5. Solicite verificação de negócio: cartão CNPJ, comprovante, telefone

## Erros comuns

- Portfólio pessoal em vez de empresarial
- Sem método de pagamento vinculado
- CNPJ com endereço divergente do comprovante
$md$),
(2,2,'Como criar e verificar uma Conta de WhatsApp Business (WABA)',2,
$md$# Criando uma WABA

1. BM → Configurações do negócio → Contas → WhatsApp
2. Adicionar → Criar conta do WhatsApp
3. Nomeie a WABA (ex: `Cobranca-BR`)
4. Fuso horário e moeda
5. Vincule um Phone Number ID

## Boas práticas

- Uma WABA por linha de negócio
- Nomeie: `[Marca]-[Segmento]`
- Documente qual BM contém qual WABA
$md$),
(2,3,'Como adicionar números de telefone à API',3,
$md$# Adicionar número à API

## Requisitos

- Não pode estar em uso no app WhatsApp/Business
- SMS ou ligação para verificar
- Dedicado à API

## Passos

1. WhatsApp Manager → Números → Adicionar
2. Nome de exibição (3–35 caracteres, deve refletir a marca)
3. Categoria da empresa
4. Verificação via SMS/ligação
5. Registre o Phone Number ID
$md$),
(2,4,'Configuração de webhooks e URLs de callback',4,
$md$# Webhooks

## Configurar

1. WhatsApp Manager → Configuração → Webhooks
2. URL: `https://seu-dominio/webhook` (HTTPS obrigatório)
3. Verify token: string aleatória
4. Assine: `messages`, `message_status`

## Validação

```
GET /webhook?hub.mode=subscribe&hub.verify_token=SEU_TOKEN&hub.challenge=123
→ 200 com hub.challenge
```

## Boas práticas

- Responda em < 5 segundos
- Processe assíncrono
- Valide `X-Hub-Signature-256`
$md$),
(2,5,'Geração e gerenciamento de tokens (User, System, Temporary)',5,
$md$# Tokens

| Tipo | Duração | Uso |
|---|---|---|
| Temporary | 1–2h | Testes |
| Long-lived User | 60 dias | Dev |
| **System User** | Indefinido | ✅ Produção |

## System User Token

1. BM → Usuários → Usuários do sistema
2. Criar usuário (admin/employee)
3. Atribuir WABA + App
4. Gerar token com escopos: `whatsapp_business_messaging`, `whatsapp_business_management`
5. Guarde em cofre — nunca no repositório
$md$),
(2,6,'Boas práticas de segurança (tokens, permissões, RLS)',6,
$md$# Segurança

## Tokens
- Nunca em git
- Sempre em secrets
- Um token por integração
- Escopos mínimos

## Permissões BM
- Admin: mínimo de pessoas
- Empregado: operacional
- Financeiro: só billing

## Webhook
- Valide `X-Hub-Signature-256`
- Rejeite sem assinatura
- Log de auditoria
$md$),

(3,1,'Estrutura de um template (corpo, cabeçalho, rodapé, botões)',1,
$md$# Estrutura de Template

- **Header** (opcional): texto, imagem, vídeo, documento
- **Body** (obrigatório): até 1024 chars com `{{1}}, {{2}}`
- **Footer** (opcional): até 60 chars
- **Buttons**: 3 quick reply OU 2 CTA (URL/PHONE)

## Exemplo

```
Header: 📄 Boleto disponível
Body: Olá {{1}}, seu boleto de R$ {{2}} vence em {{3}}.
Footer: MEUS ACORDOS
Buttons: [Ver boleto] [Falar com atendente]
```

## Variáveis

- Ordem sequencial: `{{1}}, {{2}}, {{3}}`
- Nunca no início/fim sem contexto
- Forneça exemplos no cadastro
$md$),
(3,2,'Categorias: Utility vs Marketing vs Authentication',2,
$md$# Escolha da categoria

⚠️ Meta audita e faz downgrade automático.

## Utility
Resposta a ação específica do cliente. Palavras: "seu pedido", "sua fatura", "sua parcela".

## Marketing
Promocional, reativação. Palavras: "desconto", "oferta", "queremos você de volta".

## Authentication
Códigos OTP. Formato específico com botão "copiar código".

Se dúvida: categorize como **Marketing** (mais seguro).
$md$),
(3,3,'Como criar templates que passam na aprovação da Meta',3,
$md$# Aprovação

## Checklist

- [ ] Sem erros de digitação
- [ ] Sem CAPS excessivo
- [ ] Sem promessas exageradas
- [ ] Sem termos proibidos por categoria
- [ ] Variáveis com exemplos preenchidos
- [ ] URLs em domínios verificados

## Tempo

- 1 minuto a 24h
- Rejeições vêm em < 10 minutos
$md$),
(3,4,'Erros comuns que causam rejeição',4,
$md$# Rejeições

| Código | Motivo | Solução |
|---|---|---|
| INVALID_FORMAT | Variável mal posicionada | Adicione texto ao redor |
| TAG_CONTENT_MISMATCH | Categoria errada | Recategorize |
| ABUSIVE_CONTENT | Tom agressivo | Reescreva cordial |
| SCAM | Parece phishing | Evite pedir dados sensíveis |

## Cobrança sem ameaça

❌ "URGENTE! Pague AGORA ou será negativado!"
✅ "Olá {{1}}, sua parcela de {{2}} vence em {{3}}."
$md$),
(3,5,'Como editar e reenviar templates rejeitados',5,
$md$# Editando templates

- Aprovados: até 10 edições/mês (nova revisão)
- Categoria não pode mudar em edição
- Rejeitados: duplique com nome novo (`boleto_v2`)
- 3+ rejeições: abra ticket de suporte

## Boas práticas

- Nunca delete template aprovado — versione
- Documente motivos de rejeição
$md$),
(3,6,'Gerenciamento de templates em múltiplos números',6,
$md$# Templates em múltiplos números

Templates são vinculados à **WABA**, não ao número. Todos os números da mesma WABA compartilham.

## Estratégia

- Template mestre: cadastre no BM principal, replique via API
- Nome padronizado: `mca_boleto_v3`
- Automatize criação em lote via `POST /message_templates`

## Sincronização

`GET /{waba-id}/message_templates?limit=100` — compare periodicamente.
$md$),

(4,1,'Como enviar mensagens via API (cURL, Postman, SDKs)',1,
$md$# Enviando mensagens

```bash
curl -X POST https://graph.facebook.com/v20.0/{PHONE_NUMBER_ID}/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "5561999999999",
    "type": "template",
    "template": {
      "name": "boleto_vencendo",
      "language": { "code": "pt_BR" },
      "components": [
        { "type": "body", "parameters": [
          { "type": "text", "text": "João" },
          { "type": "text", "text": "R$ 150,00" }
        ]}
      ]
    }
  }'
```

Retorno: `{ "messages": [{ "id": "wamid.HBgN..." }] }`

Guarde o `wamid` para rastrear via webhook.
$md$),
(4,2,'Rastreamento de entregas e status (webhooks)',2,
$md$# Rastreamento

Webhook recebe status: `sent → delivered → read → replied`

## Payload

```json
{
  "statuses": [{
    "id": "wamid.HBgN...",
    "status": "delivered",
    "timestamp": "1700000000",
    "recipient_id": "5561999999999"
  }]
}
```

24h em `sent` = número desligado ou bloqueou.
$md$),
(4,3,'Como interpretar os status (Enviado, Entregue, Lido, Falhou)',3,
$md$# Status

| Status | Significado |
|---|---|
| `sent` | Meta aceitou |
| `delivered` | Chegou no aparelho |
| `read` | Cliente abriu |
| `failed` | Erro (ver `errors[]`) |

## Erros em `failed`

- 131047: janela 24h expirada
- 131026: não é WhatsApp
- 131051: template não aprovado
- 368: bloqueou marca

## KPIs

- Delivery > 95%
- Read > 40%
- Failed < 5%
$md$),
(4,4,'Monitoramento de qualidade (quality_rating, messaging_limit_tier)',4,
$md$# Qualidade e Limites

```
GET /{PHONE_NUMBER_ID}?fields=quality_rating,messaging_limit_tier,name_status
```

## quality_rating

- 🟢 GREEN — OK
- 🟡 YELLOW — alerta
- 🔴 RED — pause envios

## Alerta automatizado

Cron a cada 4h consulta e dispara Slack se != GREEN.
$md$),
(4,5,'Como evitar bloqueios e manter a reputação alta',5,
$md$# Anti-Ban

## Regras de ouro

1. Nunca envie sem opt-in
2. Respeite janela de 24h — fora dela só template
3. Varie templates (não use texto único para milhares)
4. Distribua entre horas (9h-18h BRT)
5. Não envie domingo/feriados
6. Ofereça saída ("responda SAIR")

## Recuperação

YELLOW: reduza volume em 50% por 48h e revise piores templates.
$md$),
(4,6,'Dashboard e relatórios (custos, conversões, desempenho)',6,
$md$# Relatórios

## Métricas essenciais

- Enviados / Entregues / Lidos / Respondidos
- Custo por template
- Conversão (respostas/enviadas)
- Reputação por número

## API

- `GET /{WABA_ID}/message_template_analytics`
- `GET /{PHONE_NUMBER_ID}/insights`

## Painel

Consolide em BI (Metabase/Looker) atualizando diário. Correlacione com receita para ROI.
$md$),

(5,1,'Diagnóstico de erros comuns (códigos de erro da API)',1,
$md$# Códigos de erro

| Código | Significado |
|---|---|
| 131047 | Janela 24h expirada |
| 131051 | Template não aprovado |
| 131026 | Não é WhatsApp |
| 131056 | Rate limit |
| 368 | Bloqueado pelo usuário |
| 190 | Token expirado |
| 100 | Parâmetro inválido |
| 133000 | Número não registrado |

## Debug

1. Confira `error.code`
2. Consulte docs oficiais
3. Reproduza com curl mínimo
4. Token expired: regere System User Token
$md$),
(5,2,'Como lidar com números banidos ou restritos',2,
$md$# Números restritos

## Sinais

- `messaging_limit_tier` cai para TIER_50
- Status FLAGGED ou RESTRICTED
- Todos envios com erro

## Ações

1. Pare envios imediatamente
2. Se RED, aguarde 24-72h
3. Não force envios
4. Analise últimos templates

Se banido definitivo: Appeal ou substituir número.
$md$),
(5,3,'Processo de revisão (Appeal) de contas banidas',3,
$md$# Appeal

## Onde

WhatsApp Manager → Insights → banner → Solicitar revisão

## Prazo

24-72h úteis. Só 1 appeal por número.

## O que escrever

- Descreva empresa e uso legítimo
- Mencione opt-in dos clientes
- Volume diário estimado
- Prints de fluxos de autorização
$md$),
(5,4,'Como aumentar limites de envio (Tiers)',4,
$md$# Escalando Tiers

Meta escala quando:

1. `quality_rating = GREEN` por 7 dias
2. Atinja 50% do tier atual (únicos/24h)
3. Bloqueio < 1%

## Ramp up

- Semana 1: 100/dia
- Semana 2: 250/dia
- Semana 3: 500/dia
- Semana 4: 1000/dia

Nunca ultrapasse — Meta bloqueia excedente.
$md$),
(5,5,'Recuperação de templates rejeitados',5,
$md$# Recuperando templates

1. Identifique motivo (WhatsApp Manager → Detalhes)
2. Corrija (texto/categoria/formato)
3. Duplique com nome novo (`boleto_v2`)
4. Submeta

3+ rejeições: abra ticket com Direct Support ou BSP.

## Prevenção

- Teste em sandbox
- Revisão interna antes de submeter
- Biblioteca de templates aprovados
$md$);
