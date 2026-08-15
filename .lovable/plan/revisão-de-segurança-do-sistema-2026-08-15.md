# Revisão de segurança do sistema

Rodei a varredura completa (banco, políticas de acesso, storage, conectores e dependências). O resultado: **1 problema real que precisa correção**, 1 ajuste recomendado e 4 itens que são falsos positivos/comportamento intencional. Nenhuma vulnerabilidade em bibliotecas (npm) foi encontrada.

## 1. Correção necessária: arquivos de devedores visíveis a mais gente do que deveria

Hoje, qualquer usuário com papel de **gestor** (além de admins) consegue baixar **todos** os arquivos anexados de devedores — inclusive de credores/carteiras que ele não tem permissão de ver. Confirmei isso na política atual do bucket `devedor-arquivos`: ela libera leitura por papel, sem checar a carteira do arquivo, enquanto o upload já checa corretamente.

Correção: reescrever a permissão de leitura para exigir a mesma checagem de escopo já usada no upload (acesso ao devedor/pasta), mantendo:
- admin: acesso total;
- dono do arquivo: acesso ao próprio;
- gestor/funcionário: só arquivos de devedores dentro dos credores que ele pode ver.

## 2. Ajuste recomendado: etiquetas do Inbox sem checagem de caixa

Quem tem o sinalizador de "inbox compartilhado" pode etiquetar/remover etiqueta de **qualquer** conversa, mesmo de caixas de mensagens às quais não tem acesso. As demais tabelas do Inbox (qualificação, conversas) já respeitam a caixa. Vou alinhar as regras de etiqueta ao mesmo escopo por caixa, preservando:
- admin com poder total;
- a trava já existente que impede apagar a etiqueta de atendente automática (só admin pode).

## 3. Itens verificados e sem ação necessária

- **Bucket `campaign-audio` público**: obrigatório para a Meta/UAZAPI baixarem a mídia pelo link. Padrão aceito e já documentado.
- **Acordos/parcelas de devedores**: as regras usam corretamente o escopo por credor. Sem problema.
- **Funções internas do banco com privilégio elevado (SECURITY DEFINER)**: são exatamente o mecanismo recomendado para evitar recursão nas regras de acesso (checagem de papel, escopo de credor, etc.). Manter como está.
- **Dependências (npm)**: nenhuma falha alta/crítica.

## Detalhes técnicos

**Migração 1 — storage `devedor-arquivos`**
- `DROP POLICY "Owner or admin can read devedor-arquivos"`.
- Nova policy SELECT: `bucket_id = 'devedor-arquivos' AND (owner = auth.uid() OR has_role(auth.uid(),'admin') OR can_view_devedor_id(auth.uid(), (storage.foldername(name))[1]::uuid))`, espelhando a lógica já usada na policy de INSERT.

**Migração 2 — `meta_whatsapp_contato_etiquetas`**
- Substituir `meta_contato_etiquetas_shared_select/_write/_delete` por versões que combinam `has_inbox_compartilhado(auth.uid())` com `EXISTS (... meta_whatsapp_contatos c WHERE c.id = contato_id AND can_view_meta_contato_folder(auth.uid(), c.folder_id))`.
- Manter no DELETE a cláusula `(origem <> 'auto_atendente' OR is_admin_user(auth.uid()))`.

**Depois das migrações**
- Confirmar no login de um funcionário/gestor que ele continua vendo e anexando arquivos dos próprios clientes e etiquetando conversas das caixas dele.
- Marcar os achados como corrigidos e atualizar a memória de segurança.

Sem impacto de custo: nenhuma nova rotina, consulta em loop ou canal em tempo real.
