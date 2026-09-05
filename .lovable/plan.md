# Botão "Gerar acordo UME" na conversa — reimplementar

O botão realmente não está lá: no cabeçalho da conversa existem hoje só qualificação, modelo, calculadora UME, sugestões, ligação, relógio, dispensar e retorno. A tela do acordo, a função de servidor e as tabelas que foram descritas antes não estão no projeto — o trabalho foi desfeito. Então é refazer, agora completo.

## O que você vai ver

1. No topo da conversa, ao lado do ícone da calculadora UME, um novo ícone de acordo (aperto de mão). Só aparece quando o cliente é da UME, do mesmo jeito que a calculadora.
2. Clicando, abre a tela "Gerar acordo UME" já com:
   - CPF do cliente preenchido;
   - Total da dívida lido na UME;
   - Valor da parcela, nº de parcelas e vencimento da 1ª parcela (você confere/ajusta);
   - Desconto calculado sozinho: total da dívida − (parcela × parcelas), no formato com ponto;
   - Entrada = valor da 1ª parcela; Data da entrada = vencimento da 1ª parcela; Vcto parcela = entrada + 30 dias; Taxa de juros = 0.
3. Botão **Simular** → o robô percorre o site (Tomadores → CPF → Acordos → Novo Acordo → preenche → Simular) e devolve o resultado com print da tela.
4. Botão **Efetivar** (só depois da simulação) → conclui, inclusive o "OK" do "Você tem certeza?".
5. Botão **Robô** (só admin) para colar endereço/token do robô e abrir a janela de login da UME uma vez por operador.
6. Cada acordo gerado fica registrado: quem fez, CPF, valores, resultado e horário.

## Detalhes técnicos

- **Migração:** `ume_backoffice_config` (server_url, token, ativo) e `ume_acordo_jobs` (user_id, cpf, telefone, conversa_id, payload jsonb, simulacao jsonb, status, screenshot_url, timestamps). `CREATE TABLE` + `GRANT` (authenticated select/insert nos jobs; service_role all; config só service_role + leitura admin) + RLS: usuário vê os próprios jobs, admin vê todos; config apenas admin via `has_role`.
- **Edge function `ume-backoffice-acordo`:** exige usuário autenticado, valida com Zod (CPF 11 dígitos, parcelas 1–24, valores > 0, datas), calcula desconto e vcto no servidor, chama o robô com token e grava o job. Ações: `sessao_status`, `abrir_login`, `divida`, `simular`, `efetivar`.
- **Robô UME (fora do Lovable):** Node + Playwright com `userDataDir` por operador; rotas `POST /ume/login-window`, `/ume/sessao-status`, `/ume/divida`, `/ume/simular`, `/ume/efetivar`; seletores num único mapa; se a tela mudar, devolve `layout_ume_mudou` e avisa por `notificar-admin`. Entrego o arquivo do robô + instruções.
- **Frontend:** novo `src/components/inbox/meta/GerarAcordoUmeDialog.tsx` (padrão do `ConsultaUmeDialog.tsx`), ícone `Handshake` no cabeçalho de `src/pages/InboxMeta.tsx` logo após o botão da calculadora, e seção de configuração do robô dentro do próprio diálogo para admin.
- Sem cron, sem polling, sem Realtime novo: tudo por clique. Custo de backend desprezível.
