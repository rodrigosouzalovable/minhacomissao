# Chamadas de voz WhatsApp (Calling API oficial) no Inbox Meta

## Viabilidade

É viável e **não precisa de BSP** (Twilio/Wati/Telnyx). A WhatsApp Business Calling API é WebRTC puro: o áudio vai direto entre o navegador do funcionário e o WhatsApp do cliente; a Graph API só troca a sinalização (SDP). Ou seja, o "provedor de mídia" é o próprio navegador — sem custo extra de provedor, só o custo da Meta (~US$ 0,017/min em chamadas de saída; entrada é gratuita).

Duas condições fora do código, que dependem de você no painel da Meta:

1. Habilitar **Calling** no número (Novo Mundo 3144) — `call_settings` com `status: ENABLED` e `call_icon_visibility` para o cliente poder ligar. Isso o sistema consegue ligar via API, mas o produto "Chamadas" precisa existir no app.
2. Assinar os campos de webhook `calls` no WABA (o webhook atual já recebe eventos; será estendido).

Sem isso, o botão aparece mas a Meta rejeita a chamada — o plano prevê mensagem de erro clara nesse caso.

## O que será construído

### 1. Botão de telefone em cada conversa
No cabeçalho da conversa do Inbox Meta Oficial, ao lado dos ícones já existentes (Tag, Modelo, Relógio, Check), entra um ícone de **telefone**:

- Verde/habilitado quando há permissão de chamada ativa (janela de 7 dias) → clica e liga na hora.
- Cinza quando não há permissão → clica e o sistema envia o template de permissão "Ligar agora"; quando o cliente aceitar, o ícone fica verde e o funcionário é avisado.
- Desabilitado com aviso se a instância não tiver Calling habilitado.

### 2. Tela de chamada
Painel flutuante (canto inferior direito, sobrepõe a conversa) com: nome + número do cliente, estado (chamando / em andamento / encerrada), cronômetro, botões **mudo** e **encerrar**. Áudio pelo microfone do navegador (pede permissão uma vez).

### 3. Chamadas recebidas
Quando o cliente liga, o painel toca: pop-up com nome/número, botões **Atender** e **Rejeitar**, com som de toque. Funciona em qualquer aba do sistema (mesmo padrão do sino de avisos), respeitando quem tem acesso à caixa daquela conversa.

### 4. Template de permissão
Criação do template UTILITY `pedido_permissao_chamada` na instância Novo Mundo 3144, com botão de permissão de chamada:
"Olá {{1}}, para agilizar sua negociação podemos falar por chamada de voz agora. Toque em *Ligar agora* para autorizar."

### 5. Histórico de chamadas
Aba **Histórico** dentro do painel de chamada e lista no card do cliente: tipo (entrada/saída), status, duração, data/hora, funcionário responsável, custo estimado. Sem gravação de áudio, conforme definido.

### 6. IAGO
O IAGO não atende chamadas. Chamada recebida sempre vai para humano; se ninguém atender, fica registrada como **perdida** e a conversa recebe a etiqueta "Aguardando Humano".

## Detalhes técnicos

**Banco (1 tabela + 1 tabela de permissão)**
- `whatsapp_chamadas`: `id`, `contato_id` (fk `meta_whatsapp_contatos`), `instancia_id` (fk `meta_whatsapp_instances`), `funcionario_id`, `waba_id`, `phone_number_id`, `telefone`, `call_id` (id da Meta), `tipo_chamada` (entrada/saida), `status` (iniciada/ringing/em_andamento/concluida/perdida/rejeitada/erro), `duracao_segundos`, `data_inicio`, `data_fim`, `custo_estimado numeric`, `erro`, `observacao`, `created_at`. Índices por `contato_id`, `call_id`, `data_inicio`.
- `meta_call_permissions`: `contato_id`, `instancia_id`, `telefone`, `status` (accepted/rejected/expired), `expira_em`, `atualizado_em`.
- Ambas com GRANT (`authenticated` CRUD, `service_role` ALL) e RLS reaproveitando `pode_ver_instancia_meta` / `can_view_meta_contato_folder`.

**Edge functions**
- `meta-call-start`: valida sessão e acesso à caixa, monta oferta SDP recebida do cliente, `POST /{phone_number_id}/calls` com `action: connect`; grava a chamada e devolve o SDP de resposta.
- `meta-call-action`: `pre_accept`, `accept`, `reject`, `terminate` para chamadas de entrada e encerramento das de saída.
- `meta-call-permission-request`: envia o template de permissão via fluxo de template já existente.
- `meta-call-settings`: liga/consulta `call_settings` do número (usado uma vez por instância, na aba API Oficial Meta).
- `meta-whatsapp-webhook` (existente): passa a tratar `calls` — `connect`, `terminate`, `ringing`, `call_permission_update` — atualizando `whatsapp_chamadas` e `meta_call_permissions`, e notificando o front via Realtime na tabela `whatsapp_chamadas`.

**Frontend**
- `src/hooks/useMetaCall.tsx`: máquina de estados WebRTC (`RTCPeerConnection`, `getUserMedia` áudio, criação/aplicação de SDP, mudo, encerrar, cronômetro).
- `src/components/inbox/meta/ChamadaFlutuante.tsx`: painel da chamada ativa.
- `src/components/inbox/meta/ChamadaEntrandoDialog.tsx`: pop-up de chamada recebida + toque, montado no layout do app.
- `src/components/inbox/meta/HistoricoChamadasDialog.tsx`: histórico por contato.
- `src/pages/InboxMeta.tsx`: ícone `Phone` no cabeçalho com os três estados.
- Realtime: **um único canal** já existente do Inbox recebe também `whatsapp_chamadas` (sem novo polling, sem cron) para manter o custo neutro.

**Custos**
Sem impacto em Lovable Cloud além de uma tabela pequena e um filtro extra no canal Realtime já ativo. O custo real é o da Meta por minuto de chamada de saída, exibido como estimativa no histórico.

## Passos

1. Migração das duas tabelas com GRANT + RLS.
2. Edge functions de chamada e extensão do webhook para eventos `calls`.
3. Hook WebRTC e componentes de chamada (ativa, entrando, histórico).
4. Ícone de telefone no cabeçalho da conversa com os três estados.
5. Habilitar Calling e criar o template de permissão na instância Novo Mundo 3144.
6. Teste ponta a ponta: saída com permissão, saída sem permissão (template), entrada atendida, entrada rejeitada, perdida.
