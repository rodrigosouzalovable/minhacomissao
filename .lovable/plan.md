# Credor: logo maior, Novo Mundo correta e campanha atual como UME

## O que muda

### 1. Logo maior no cabeçalho do Inbox
O selo de credor ao lado do nome do contato passa a exibir a logo bem maior (de ~14px para ~28px de altura), com o nome do credor ao lado, ficando fácil de identificar de longe. O selo continua clicável para trocar o credor.

### 2. Logo Novo Mundo corrigida
A logo atual do Novo Mundo é uma faixa horizontal que praticamente desaparece em tamanho pequeno. Ela será substituída pela imagem quadrada azul "nm." enviada agora, usada tanto no cabeçalho do Inbox quanto na lista de troca de credor.

### 3. Campanha em andamento marcada como UME
A campanha "UME 1" (em execução, 784 contatos) está sem credor definido. Ela será marcada como UME:
- a campanha e seus itens passam a ter credor UME;
- os contatos já atingidos por ela recebem credor UME (sem sobrescrever contatos que já tenham credor definido manualmente);
- as mensagens que ainda faltam sair já saem marcadas como UME automaticamente.

### 4. Envio Meta sem imagem no seletor
No campo "Credor desta campanha", as opções ficam apenas com o nome (Não informar / Novo Mundo / UME), sem miniatura de logo.

## Detalhes técnicos

- `src/assets/logo-novo-mundo.png`: substituída pela imagem quadrada enviada (asset em repo, sem alteração de import).
- `src/lib/credorMarcas.ts`: sem mudança de contrato.
- `src/pages/InboxMeta.tsx`: selo do cabeçalho com `h-7` (logo maior, `object-contain`), padding ajustado; itens do popover com logo `h-5`.
- `src/pages/EnvioMeta.tsx`: remove `<img>` dos `SelectItem` do seletor de credor.
- Migração de dados (SQL pontual, sem novo cron/índice/polling — custo de backend inalterado):
  - `update envio_meta_job set credor='ume' where id='597c89bd-...'`
  - `update envio_meta_job_item set credor='ume' where job_id='597c89bd-...'`
  - `update meta_whatsapp_contatos set credor='ume'` para os telefones (sufixo 8 dígitos) dos itens dessa campanha, apenas onde `credor is null`.

## Passos

1. Trocar o arquivo da logo Novo Mundo.
2. Aumentar a logo no cabeçalho do Inbox.
3. Remover as logos do seletor no Envio Meta.
4. Rodar o backfill de credor UME da campanha em andamento.
5. Build/typecheck.
