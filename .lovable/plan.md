

## Plano: Integrar Status e Contatos ao Aquecimento Automático

### Resumo

Adicionar duas funcionalidades ao sistema de aquecimento existente: **postagem automática de status** (stories) e **salvamento automático de contatos** na agenda do WhatsApp, ambos integrados ao ciclo de 15 minutos da Edge Function `whatsapp-aquecimento`.

---

### 1. Migração de Banco de Dados

**Alterações na tabela `whatsapp_aquecimento_interacoes`:**
- Adicionar coluna `tipo_interacao` (default `'mensagem'`, valores: `mensagem`, `status`, `contato_salvo`)
- Criar index parcial para consultas de status do dia

**Nova tabela `whatsapp_aquecimento_status_log`:**
- `id`, `instancia_id`, `tipo` (text/image/video), `conteudo`, `conteudo_url`, `postado_em`, `status` (ENVIADO/FALHOU)
- Para rastrear exatamente qual conteúdo foi postado e evitar repetição

**Novas chaves em `whatsapp_aquecimento_config`:**
- `salvar_contatos_auto` (boolean, default true)
- `postar_status_auto` (boolean, default true)
- `status_incluir_imagens` (boolean, default true)
- `status_incluir_videos` (boolean, default false)

---

### 2. Edge Function `whatsapp-aquecimento` (atualizar)

Adicionar ao ciclo existente, **após** o envio de mensagens entre números:

**a) Postagem de Status por fase:**

| Fase | Dias | Status/dia | Tipos |
|------|------|-----------|-------|
| 0-1 | 1-7 | 0-1 | texto |
| 2 | 8-14 | 1 | texto + imagem |
| 3-4 | 15-28 | 1-2 | texto + imagem |
| 5 | 29+ | 1-2 | texto + imagem + vídeo |

- Pool interno de ~30 textos e ~15 URLs de imagens genéricas (Unsplash)
- Horário aleatório dentro das faixas (manhã 40%, tarde 40%, noite 20%)
- Verificar se já postou hoje antes de postar
- Chamar `POST /send/status` da UAZAPI com `type`, `text`, `file`, `background_color`, `font`
- Registrar na tabela de interações com `tipo_interacao = 'status'`

**b) Salvamento de Contatos:**
- Ao final do ciclo, buscar mensagens recebidas recentes (últimas 2h) de números não cadastrados em `whatsapp_contatos`
- Para cada número novo: chamar `POST /contact/add` da UAZAPI
- Registrar interação com `tipo_interacao = 'contato_salvo'`

---

### 3. Dashboard Atualizado (`src/pages/Aquecimento.tsx`)

**3 novos cards de métricas:**
- "Status hoje" — X/Y postados (percentual)
- "Contatos salvos" — total este mês
- "Reputação" — score baseado em: status postados + contatos + taxa sucesso

**Colunas adicionais na tabela de números:**
- Status hoje (Postou / Pendente / Fora do horário)
- Contatos salvos (count)
- Último status (horário)

**Timeline atualizada:**
- Ícones distintos para mensagem, status e contato salvo

---

### 4. Painel de Configuração Simplificado

Novo componente `StatusConfig` dentro de `AquecimentoConfigTab.tsx`:
- Toggle: Habilitar aquecimento automático
- Toggle: Salvar contatos automaticamente
- Toggle: Postar status automaticamente
- Sub-toggles (se status habilitado): Incluir imagens (Fase 2+), Incluir vídeos (Fase 5+)
- Botão "Restaurar padrões"

---

### 5. Notificações Adicionais

Integrar ao sistema de notificações existente (`aquecimento_notificacoes`):
- Primeiro status postado por um número
- Número salvou 50+ contatos
- Falha 3x seguidas ao postar status

---

### 6. Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| `supabase/functions/whatsapp-aquecimento/index.ts` | Adicionar lógica de status e contatos ao ciclo |
| `src/pages/Aquecimento.tsx` | Novos cards, colunas e ícones na timeline |
| `src/components/aquecimento/AquecimentoDashboard.tsx` | Cards e timeline com tipos novos |
| `src/components/aquecimento/AquecimentoConfigTab.tsx` | Painel simplificado com toggles |
| Migração SQL | Nova coluna, config keys, index |

### Observações

- **Não** será criada Edge Function separada para status — tudo roda dentro do ciclo existente de 15min, simplificando manutenção
- O pool de conteúdos (textos/imagens) fica hardcoded na Edge Function, sem necessidade de tabela extra
- A funcionalidade de salvar contatos depende do webhook já existente no `whatsapp-chatbot` para detectar números novos, mas o salvamento na agenda UAZAPI será feito pelo ciclo de aquecimento

