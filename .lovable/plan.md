## Por que todas as instâncias foram desativadas

Encontrei a causa no código de `src/pages/Acionamento.tsx` (linhas 469–489):

Toda vez que a página de Acionamento abre, roda `checkInstanceConnections`, que faz um teste de conexão UAZAPI em cada instância. Se a UAZAPI responde "desconectado" (ou o endpoint falha por timeout/erro), o código **automaticamente marca `ativo = false` no banco**.

Hoje os 175 chips estão quase todos desconectados (você está em fase de aquecimento, sem QR escaneado em massa) e o status_check está respondendo `connected:false` para todos. Resultado: 162 marcados inativos, apenas 13 ativos (a UI mostra "0/107 conectados").

Esse comportamento é abusivo: uma falha temporária de rede ou da UAZAPI desativa instâncias em massa, e elas só voltam se conseguirem responder `connected:true` em um próximo ciclo.

## Plano

### 1) Botão "Ativar todas" no diálogo de Configurações WhatsApp
Adicionar um botão ao lado de "Conectar via QR Code / Código / Manual" no header do diálogo de instâncias UAZAPI, com label **"Ativar todas"**. Ao clicar:
- Confirmação ("Marcar todas as 175 instâncias como ativas?")
- `UPDATE user_whatsapp_instances SET ativo = true` (escopado ao `user_id` do admin que abriu)
- Toast com contagem
- Recarregar lista

### 2) Parar a desativação automática agressiva
Remover o bloco que faz `update ativo:false` automaticamente em `checkInstanceConnections` (linhas 469–476 de `Acionamento.tsx`). O `connectionStatus` em memória continua refletindo "desconectado" no ícone Wi‑Fi, mas o flag `ativo` no banco passa a ser controlado **só manualmente** pelo usuário (toggle individual ou novo botão "Ativar todas"). Isso já é coerente com a regra do projeto "Manual Deactivation".

A re‑ativação automática quando volta a conectar (linhas 478–489) também sai, pelo mesmo motivo.

### 3) Onde colocar o botão
O componente do diálogo das instâncias está em `src/pages/Acionamento.tsx` (renderiza o "Configurações WhatsApp" da screenshot). Vou inserir o botão `Ativar todas` antes de "Conectar via QR Code", com ícone `Power` e cor outline.

### Arquivos a alterar
- `src/pages/Acionamento.tsx` — adicionar handler `ativarTodasInstancias`, botão no header do diálogo, remover bloco de desativação/reativação automática (linhas 469–489).

### Não vai mexer
- Webhooks, edge functions de aquecimento, RLS — nada disso muda.
- Toggle individual por instância continua funcionando igual.