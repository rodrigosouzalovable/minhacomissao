# Ativar o botão “Gerar acordo UME” com robô em VPS

## Situação confirmada

A parte dentro do Meus Acordos já está quase pronta:

- O botão, a tela de preenchimento, **Buscar dívida**, **Simular** e **Efetivar** já existem.
- O sistema já calcula desconto, entrada, vencimento seguinte e registra quem executou cada operação.
- As tabelas do histórico já existem no banco.
- Hoje não há endereço/token configurado e nunca houve uma simulação registrada.
- O que falta é o **servidor externo com o navegador automatizado**. O `server.js` atual do projeto é de outro robô (CobMais) e não implementa as rotas da UME.

## Antes de contratar

Os termos públicos da UME proíbem scraping/engenharia reversa sem consentimento prévio. Antes de ativar a automação, obter autorização escrita da UME ou confirmar uma API/parceria oficial. Se houver API oficial, ela será preferida ao navegador automatizado porque é mais estável e reduz risco de bloqueio.

Sem essa autorização, o trabalho pode ser preparado e testado em ambiente controlado, mas não deve ser colocado em produção.

## VPS recomendada

**Recomendação:** Hostinger **KVM 2**, região Brasil/São Paulo, Ubuntu 24.04.

- 2 vCPU, 8 GB RAM, 100 GB NVMe.
- Preço observado: aproximadamente **R$ 43,99/mês promocional**, renovando perto de **R$ 77,99/mês**; confirmar no checkout.
- 8 GB dá folga para Chromium, sessão gráfica e registros. O KVM 1 de 4 GB funciona para um único navegador, mas tem pouca margem.
- Alternativa mais robusta e normalmente mais cara: Vultr São Paulo, com cobrança por hora, firewall e snapshots.
- Custo recorrente novo: a mensalidade da VPS e, se contratado, snapshot/backup. Não será criado cron nem processamento contínuo no Lovable Cloud; o robô será chamado somente quando alguém usar o botão.

### O que selecionar na compra

1. Região **Brasil/São Paulo**.
2. **Ubuntu 24.04 LTS** sem painel cPanel.
3. KVM 2 / 8 GB RAM.
4. Backup ou snapshot automático diário.
5. Autenticação SSH por chave; não enviar senha da VPS pelo chat.

## O que será instalado na VPS

- Node.js LTS, Playwright e Chromium.
- Serviço próprio do robô UME, reiniciado automaticamente após queda/reboot.
- Sessão persistente separada por operador, para não pedir login a cada acordo.
- Área de trabalho remota protegida para realizar o primeiro login e eventuais verificações visuais.
- HTTPS em um subdomínio, por exemplo `robo.seudominio.com.br`.
- Firewall fechado por padrão, SSH por chave, proteção contra tentativas de acesso e registros com rotação.
- Backup da configuração e da sessão do navegador, sem registrar CPF, senha ou conteúdo sensível nos logs.

## Robô UME a concluir

Criar um pacote separado, pronto para instalar na VPS, com estas operações já esperadas pelo Meus Acordos:

1. **Verificar sessão** — informa se o operador continua conectado.
2. **Abrir login** — abre a UME na área de trabalho remota para login manual.
3. **Buscar dívida** — acessa Tomadores, pesquisa o CPF e devolve o total.
4. **Simular** — abre Acordos → Novo Acordo, preenche desconto, entrada, datas, parcelas e taxa zero; devolve resumo e captura da tela.
5. **Efetivar** — somente após uma simulação válida e confirmação humana, conclui o acordo e confirma o aviso final.

Proteções obrigatórias:

- Uma operação por sessão de operador para evitar cliques simultâneos.
- Token forte entre Meus Acordos e a VPS; nunca exposto no navegador do usuário.
- Revalidar os valores antes de efetivar; uma simulação antiga ou alterada não pode ser concluída.
- Parar e avisar o administrador quando a tela da UME mudar, sem tentar cliques aproximados.
- Capturas protegidas e com prazo curto de retenção.
- Sem tentativas automáticas repetidas em ações financeiras.

## Ajustes finais no Meus Acordos

- Criar a migração versionada das duas tabelas que hoje existem apenas no banco e auditar as permissões: cada usuário acessa seus próprios registros; administrador acessa todos; configuração somente para administrador.
- Validar o endereço do robô como HTTPS em produção e guardar o token de forma protegida.
- Mostrar o botão de acordo e a calculadora somente em conversas identificadas como UME.
- Melhorar a confirmação de **Efetivar**, exibindo CPF, total, desconto, entrada, parcelas e vencimento antes do clique definitivo.
- Registrar falhas por etapa sem armazenar credenciais.

## Ativação, em ordem

1. Obter autorização da UME ou acesso à API oficial.
2. Contratar a VPS indicada e apontar um subdomínio para o IP dela.
3. Preparar o pacote do robô e o instalador da VPS.
4. Instalar HTTPS, firewall, serviço automático, área remota e backups.
5. Fazer o primeiro login manual na UME pela área remota.
6. Cadastrar no botão **Robô** apenas o endereço HTTPS e o token forte.
7. Testar com um CPF autorizado: sessão → dívida → simulação, sem efetivar.
8. Conferir todos os campos com a tela real da UME e ajustar os seletores.
9. Efetivar um acordo de homologação autorizado e conferir o registro no histórico.
10. Liberar para os operadores definidos e acompanhar os primeiros acordos.

## O que preciso receber

- Confirmação de autorização da UME ou documentação da API oficial.
- Depois da compra: IP público, subdomínio escolhido e usuário SSH. Acesso deve ser por chave; senhas, conta Google e credenciais UME não devem ser enviadas no chat.
- Uma sessão acompanhada para você fazer pessoalmente o login da UME na área remota.
- Um CPF de homologação autorizado e os valores esperados para validar a simulação sem risco.

## Resultado esperado

O operador abre a conversa UME, confere os valores, simula no portal real, vê a captura e só então efetiva. A VPS permanece ativa, recupera o robô após reinicializações e mantém a sessão; qualquer mudança na tela interrompe a operação com aviso, em vez de arriscar um acordo incorreto.
