

## Resposta direta

**Sim, é possível** — mas com uma ressalva importante de segurança. UAZAPI suporta adicionar participantes em grupo via endpoint `/group/updateParticipants` (action `add`). Porém, só o **dono/admin do grupo** pode adicionar outros números. Como o grupo "Aquecimento WhatsApp" foi criado pela instância `62981810202 IPHONE B1`, ela é a admin e pode adicionar todas as outras automaticamente.

**Risco de ban:** o WhatsApp é sensível a adições automáticas em massa. Adicionar muitos números rápido pode marcar a instância admin como spam. Vou aplicar delays e limites pra mitigar.

## Plano

### 1. Cadastro do grupo (já discutido antes)
- Tabela `whatsapp_aquecimento_grupos`: `id`, `group_jid`, `nome`, `instancia_admin_id` (qual instância criou/admin), `auto_add_novas`, `ativo`.
- UI em **Aquecimento → Configuração**: cadastrar JID `120363xxx@g.us`, marcar `IPHONE B1` como admin, ativar toggle "Adicionar automaticamente novas instâncias".

### 2. Auto-add ao conectar nova instância
Estratégia em duas camadas:

**a) Hook no momento da conexão**
- Quando uma instância marca status `connected` (já existe lógica em `whatsapp-qr` / sync), disparar uma função que:
  - Verifica se há grupos com `auto_add_novas = true`.
  - Pega o número da nova instância (`555499...@s.whatsapp.net`).
  - Chama UAZAPI da instância admin: `POST {server_url}/group/updateParticipants` com `{groupjid, action: "add", participants: [novo_numero]}`.
  - Aguarda 30-90s antes de cada add (anti-ban).
  - Loga sucesso/erro em nova tabela `whatsapp_aquecimento_grupo_membros` (`grupo_id`, `instancia_id`, `adicionado_em`, `status`).

**b) Backfill / sweep periódico**
- O cron de aquecimento (`whatsapp-aquecimento`, 15 em 15 min) ganha um bloco extra: lista instâncias ativas que NÃO estão na tabela `whatsapp_aquecimento_grupo_membros` e adiciona 1 por ciclo (no máx) com delay aleatório.
- Isso pega instâncias que conectaram fora do hook ou falharam na primeira tentativa.

### 3. Tratamento de falhas comuns
- **"Not admin"** → marcar grupo como inválido, alertar usuário no Inbox/dashboard.
- **"Number not on WhatsApp"** → ignorar (não deveria acontecer se a instância está conectada).
- **"Privacy settings"** → alguns números só aceitam serem adicionados via convite. Nesse caso, a UAZAPI retorna o link de convite — vou registrar e mostrar no dashboard pra o usuário enviar manualmente uma vez.
- Erros UAZAPI desconectado retornam 200 com `fallback:true` (padrão do projeto).

### 4. Limites anti-ban
- Máx **3 adds/dia** pela instância admin.
- Delay aleatório 30-120s entre adds.
- Respeitar horário 7h-21h BRT e blackout dominical.
- Não tentar re-adicionar quem saiu manualmente (registrar status `removido_manualmente`).

### Arquivos a tocar
- **Migration**: criar `whatsapp_aquecimento_grupos` (se ainda não existe do plano anterior) + `whatsapp_aquecimento_grupo_membros` com RLS admin-only.
- **`supabase/functions/whatsapp-aquecimento/index.ts`**: bloco de sweep para auto-add pendentes.
- **(nova)** `supabase/functions/add-to-warming-group/index.ts`: chamada pontual quando instância conecta + reuso pelo cron.
- **`supabase/functions/whatsapp-qr/index.ts`** (ou onde marca `connected`): chamar a function acima após confirmação de conexão.
- **`src/components/aquecimento/AquecimentoConfigTab.tsx`**: UI de cadastro do grupo + toggle auto-add + lista de membros com status.

### Garantias
- ✅ Funciona automaticamente sem intervenção manual a cada nova conexão.
- ✅ Respeita limites pra não derrubar a instância admin.
- ✅ Combina com o resto do plano (filtro de Inbox + envio IA no grupo) feito anteriormente.

### Aviso de custo (Lovable Cloud)
- Adições são chamadas HTTP simples para UAZAPI (sem IA, sem storage). **Custo desprezível.**
- Tabela de membros é pequena (1 row por par grupo×instância).

### Fora de escopo
- Criar o grupo automaticamente (você já criou).
- Remover membros automaticamente.
- Promover outras instâncias a admin.

