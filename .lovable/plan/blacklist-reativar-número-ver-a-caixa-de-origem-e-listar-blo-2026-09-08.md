# Blacklist: reativar número, ver a caixa de origem e listar bloqueados da campanha

## Objetivo
1. Na aba **Blacklist**, um botão por número para **reativar** (sai da blacklist e volta a receber mensagens).
2. Saber **em qual caixa de mensagens** o cliente estava quando clicou em "Bloquear número"/"Bloquear contato".
3. Em **Campanhas → Ver detalhes**, mostrar os números da campanha que **não foram enviados por estarem na blacklist**.

## O que já existe (confirmado)
- A blacklist é a tabela de supressão com motivo iniciado em `blacklist...`; guarda telefone, nome, instância, credor e data — **não guarda a caixa** nem o texto do botão clicado.
- O bloqueio é gravado em dois pontos: no fluxo do IAGO e no webhook do WhatsApp Meta.
- A tela de Blacklist hoje só tem "abrir conversa" e um ícone de lixeira (remover), sem confirmação e sem rótulo claro.
- Ao iniciar uma campanha, os números da blacklist são **descartados antes de criar a fila** e apenas contados no log — por isso hoje não há como listá-los depois.

## Mudanças

### 1. Botão "Reativar" na Blacklist
- Substituir o ícone de lixeira por um botão com rótulo **Reativar**, com confirmação ("Este número volta a receber campanhas e lembretes").
- Ao confirmar: remove o registro da blacklist, mostra aviso de sucesso e atualiza a lista.
- Disponível para administradores e para parceiros Meta nas instâncias próprias.

### 2. Caixa de mensagens de origem
- Passar a gravar, no momento do bloqueio: **caixa (id e nome)** e o **texto/botão** que gerou o bloqueio ("Bloquear número" x "Bloquear contato").
- Na tabela da Blacklist: nova coluna **Caixa**, filtro por caixa e inclusão de caixa/origem na exportação.
- Bloqueios antigos (sem esse dado) mostram "—"; quando o contato ainda existir no Inbox, mostra a caixa atual como referência, sinalizada como "caixa atual".

### 3. Bloqueados por blacklist na campanha
- Ao iniciar a campanha, além de descartar os números da blacklist, **salvar a lista** (telefone, nome, credor) no registro da campanha.
- Em **Ver detalhes**, novo bloco recolhível **"Bloqueados pela blacklist (N)"** com a lista dos números que não serão enviados, botão de copiar e exportação em Excel; também um contador junto do resumo do topo.
- Campanhas já existentes mostram o bloco vazio com aviso de que o dado passou a ser registrado a partir de agora.

## Detalhes técnicos
- Migração: adicionar em `meta_destinatario_supressao` as colunas `caixa_id uuid`, `caixa_nome text`, `origem_texto text` (+ índice por `caixa_id`); adicionar em `envio_meta_job` a coluna `bloqueados_blacklist jsonb NOT NULL DEFAULT '[]'`.
- `_shared/iago.ts` (`suprimirDestinatario`): aceitar os novos campos via objeto `origem`, sem sobrescrever valores existentes com nulo.
- `meta-whatsapp-webhook/index.ts`: no bloqueio, buscar `folder_id`/nome da caixa do contato e o texto recebido, e repassar.
- `envio-meta-massa-iniciar/index.ts`: montar o array dos descartados por blacklist e persistir em `bloqueados_blacklist` ao criar o job.
- `src/pages/Blacklist.tsx`: novos campos na consulta, coluna e filtro de caixa, botão Reativar com confirmação, invalidação da query.
- `src/components/meta/CampanhaDetalheDialog.tsx`: bloco recolhível com a lista, cópia e exportação; tipo do job no contexto de envio recebe o novo campo.
- Redeploy das funções afetadas. Sem novos crons, polling ou Realtime — sem impacto de custo.

## Verificação
- Build sem erros.
- Blacklist: reativar remove o número e ele volta a ser elegível; coluna Caixa preenchida em bloqueios novos.
- Ver detalhes de uma campanha nova: lista de bloqueados pela blacklist aparece com a contagem correta.
