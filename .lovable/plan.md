# Liberar o envio da campanha do Thiago (BM Goodice)

## O que o banco mostra

A campanha "Esquentar BM goodice" (1.044 contatos, 0 enviados) foi iniciada com **uma única instância**: AMARAL +1 555-333-0558.

O log de envios dessa instância traz o erro real da Meta:

```text
(#131037) WhatsApp provided number needs display name approval before message can be sent.
```

Ou seja: é um número fornecido pela própria Meta (número de teste) e a Meta só libera envios depois que o **nome de exibição for aprovado**. Também há um `#131042` (pendência de cobrança) registrado nesse número.

Como a campanha tinha só essa instância, a primeira falha ativou a regra de "ignorar instância após falha" e o job encerrou com "Todas as instâncias selecionadas foram ignoradas por falhas consecutivas" — mensagem que não explica nada ao usuário. E o botão para reativar a instância no job é restrito a administradores, então ele ficou sem saída.

O número dele que está apto hoje é **AMARAL 62 8273-8416** (GREEN, ativo, cota 2000/dia, 72 usados).

## O que será feito

1. **Relançar a campanha atual** pela instância apta: os 1.044 contatos pendentes passam para AMARAL 62 8273-8416 e a campanha volta a rodar com os mesmos delays.
2. **Erro da Meta explicado na tela**: quando a instância for bloqueada por `#131037` (nome não aprovado) ou `#131042` (pendência de cobrança), o painel da campanha mostra o motivo real em texto claro, em vez de "falhas consecutivas".
3. **Pré-checagem antes de iniciar**: se todas as instâncias escolhidas estiverem com nome não aprovado / pendência de cobrança, a campanha não inicia às cegas — avisa o motivo e sugere as instâncias aptas do próprio usuário.
4. **O dono da campanha passa a poder se desbloquear**: reativar instância do job e adicionar instâncias com cota livre deixam de ser exclusivos de admin para o próprio dono do job.
5. **Correção de isolamento**: a lista de "instâncias com cota livre" hoje é montada com acesso total e mostraria números de outros donos a um parceiro. Passa a respeitar a visibilidade do usuário.

Observação: nada disso faz o número +1 555-333-0558 enviar. Para usá-lo, o nome de exibição precisa ser aprovado pela Meta e a cobrança da BM regularizada.

## Detalhes técnicos

- `envio-meta-massa-tick`: ao bloquear instância, gravar o motivo por instância (novo campo em `falhas_por_instancia_run` ou mapa `motivo_bloqueio_run` no job) classificando `#131037` / `#131042` / `#131031` como bloqueio permanente do número; usar esse motivo em `encerrarJobSemDisponibilidade` e no aviso de WhatsApp.
- `envio-meta-massa-control`: em `desbloquear_instancia_run` e `adicionar_instancias_livres`, permitir `job.user_id === user.id` além de admin; em `instancias_livres`, filtrar por `pode_ver_instancia_meta(user.id, i.id)`.
- `envio-meta-massa-iniciar`: pré-checagem com `meta_name_status` / último erro conhecido das instâncias selecionadas; se nenhuma apta, retornar erro com motivos por instância.
- `CampanhaInstanciasPanel.tsx` / `CampanhaDetalheDialog.tsx`: exibir o motivo humanizado (reaproveitar `humanizarErroEnvio.ts`).
- Operação de dados para o job `e9461316-…`: `instancia_ids = {89eaf081-…}`, limpar `instancias_bloqueadas_run` / `falhas_por_instancia_run`, itens pendentes com `instancia_id` da nova instância, `status='rodando'`.
- Sem novos crons, polling ou tabelas — sem impacto de custo no Lovable Cloud.
