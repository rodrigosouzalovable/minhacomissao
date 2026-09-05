# Gerar acordo na UME direto do Inbox Meta Oficial

Sim, é possível. O caminho que você descreveu (login, Tomadores, CPF, Acordos, Novo Acordo, preencher, Simular, Efetivar) pode ser feito pelo sistema, com uma condição: como a UME só entra por "Login via Google", quem faz o login é uma pessoa, uma única vez, numa janela de navegador do robô. Depois disso a sessão fica salva e o sistema usa ela sozinho nos próximos acordos.

## Como vai funcionar no dia a dia

1. Uma vez por operador: na aba de configuração da UME, clicar em "Abrir janela de login". O navegador do robô abre a tela da UME, a pessoa clica em "Login via Google" e entra com o login dela. Pronto — a sessão fica guardada com o nome do operador.
2. Na conversa do cliente no Inbox Meta Oficial, um botão novo: **"Gerar acordo UME"**.
3. Abre um painel já preenchido com o que o sistema sabe da conversa:
   - CPF do cliente (o mesmo que a calculadora UME já usa);
   - Total da dívida, lido na hora do próprio backoffice da UME;
   - Nº de parcelas e valor da parcela negociados (você confere/ajusta);
   - **Desconto** calculado automaticamente: total da dívida menos (parcela × nº de parcelas) — no exemplo da cliente, 5.813,31 − 1.108,80 = 4.704,51, já enviado no formato com ponto (4704.51);
   - **Entrada** = valor da primeira parcela (110.88);
   - **Data entrada** = vencimento da 1ª parcela (20/09/2026);
   - **Vcto parcela** = data da entrada + 30 dias (20/10/2026), calculado sozinho;
   - **Tx de juros** = 0, fixo.
4. Você clica em **Simular**. O robô faz o caminho completo no site (Tomadores → CPF → Acordos → Novo Acordo → preenche → Simular) e traz o resultado da simulação de volta para a tela, com um print da tela para conferência.
5. Se estiver certo, você clica em **Efetivar** e o sistema conclui, inclusive o "OK" da tela "Você tem certeza?". Nada é efetivado sem esse seu clique.
6. Tudo fica registrado: quem gerou, CPF, valores, resultado e horário.

## O que você precisa providenciar

O robô precisa de um computador ou servidor sempre ligado para manter o navegador e a sessão do Google (é a mesma ideia do robô do CobMais, mas separado, só da UME, como você pediu). Eu entrego o programa do robô pronto e as instruções de instalação; o endereço dele é colado numa tela de configuração dentro do sistema.

Nesta primeira etapa paramos no "Efetivar" concluído. A emissão/coleta do boleto fica para a etapa seguinte.

## Detalhes técnicos

- **Robô UME (novo, fora do Lovable):** serviço Node + Playwright com contexto persistente por operador (`userDataDir` separado), expondo `POST /ume/login-window`, `/ume/sessao-status`, `/ume/simular`, `/ume/efetivar`, `/ume/screenshot`, protegido por token compartilhado. Seletores da UME centralizados num único mapa para ajuste rápido; se a tela mudar, retorna erro identificado ("layout do backoffice UME mudou") e avisa pelo `notificar-admin` já existente, sem chutar valores.
- **Edge function `ume-backoffice-acordo`:** exige usuário autenticado, valida entrada com Zod (CPF, parcelas 1–24, valores, datas), calcula desconto/vcto parcela no servidor, repassa ao robô e grava o resultado. Ações: `sessao_status`, `abrir_login`, `simular`, `efetivar`.
- **Migração:** `ume_backoffice_config` (server_url, token, ativo) e `ume_acordo_jobs` (user_id, cpf, telefone, conversa_id, payload jsonb, simulacao jsonb, status, screenshot_url, criado_em). `CREATE TABLE` + `GRANT` (`authenticated` select/insert; `service_role` all) + RLS: cada usuário vê os próprios jobs, admin vê todos; config só admin.
- **Frontend:** novo `src/components/inbox/meta/GerarAcordoUmeDialog.tsx` (mesmo padrão do `ConsultaUmeDialog.tsx`), botão no cabeçalho da conversa em `src/pages/InboxMeta.tsx`, e tela de configuração do robô/sessão para o admin.
- Sem cron e sem polling contínuo: tudo por demanda, disparado pelo clique. Impacto de custo em Cloud desprezível.
