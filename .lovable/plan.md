
Corrigir isso exige persistência local no banco, não só releitura da API.

### O problema exato
Hoje o painel de perfil faz isso ao reabrir o editar da instância:

1. limpa `foto`, `nome`, `descrição`, `endereço` e `email`
2. tenta buscar da UAZAPI
3. a busca principal chama `POST /business/get/profile` com `{"jid":""}` e está voltando `400 Could not parse Phone`
4. o fallback `GET /instance/info` para essa instância está voltando `404`
5. como não existe cache desses dados em `user_whatsapp_instances`, o formulário fica vazio de novo

Também confirmei no replay que o nome digitado aparece, o loading roda, e depois o input volta vazio.

### O que vou implementar

#### 1. Persistir os dados do perfil na tabela da instância
Adicionar colunas em `user_whatsapp_instances` para guardar:
- `whatsapp_profile_name`
- `whatsapp_profile_photo_url`
- `whatsapp_profile_description`
- `whatsapp_profile_address`
- `whatsapp_profile_email`

Isso vai permitir reabrir o editar com os últimos valores salvos, mesmo se a API externa falhar.

#### 2. Reidratar o formulário a partir do banco antes de chamar a API
Em `src/pages/Acionamento.tsx`:
- incluir esses campos no `select` das instâncias
- ao clicar em editar, passar esses valores para `editingInstance`
- preencher o estado do formulário imediatamente com o cache salvo
- evitar limpar tudo logo no início de `loadWhatsAppProfile`

#### 3. Atualizar o cache ao salvar nome, foto e dados comerciais
Depois de:
- `handleSaveProfileName`
- `handleSaveProfilePhoto`
- `handleSaveProfileBusiness`

também salvar os mesmos valores em `user_whatsapp_instances`, para que permaneçam visíveis ao voltar ao diálogo.

#### 4. Melhorar a leitura da API sem apagar o que já existe
Ajustar `loadWhatsAppProfile` para:
- usar resposta da API apenas para complementar/substituir quando vier valor válido
- não sobrescrever com vazio
- não depender de `jid: ''` como fonte única de verdade
- manter a foto/nome já salvos se a UAZAPI responder erro

#### 5. Sincronizar a lista local após salvar
Atualizar `instances` e `editingInstance` em memória após cada save, para o usuário ver persistência imediata sem depender de nova busca.

### Arquivos afetados
- `src/pages/Acionamento.tsx`
- nova migration SQL em `supabase/migrations/...`

### Resultado esperado
Ao importar a foto, definir o nome e salvar:
- fechar e reabrir o editar da instância manterá foto e nome
- descrição, endereço e email também permanecerão
- se a API da UAZAPI falhar, o painel continuará mostrando os últimos dados salvos

### Detalhe técnico
A causa não é só “leitura do nome”. O problema estrutural é:
```text
UI limpa estado
→ UAZAPI falha (/business/get/profile 400, /instance/info 404)
→ sem cache no banco
→ formulário volta vazio
```

A correção robusta é:
```text
Salvar em user_whatsapp_instances
→ reidratar do banco ao abrir
→ tentar sincronizar com UAZAPI sem apagar cache existente
```
