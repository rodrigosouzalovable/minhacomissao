# Contatos Novo Mundo em lotes para atualização cadastral

## Conferência realizada
- O arquivo anexado tem **115.968 linhas: 1 cabeçalho e 115.967 contatos**, ocupa aproximadamente **3 MB** e contém três colunas: **A = telefone, B = variável 1, C = variável 2**.
- Todos os telefones têm 11 dígitos; há **611 repetições pelos últimos oito dígitos**, resultando em **115.356 sufixos distintos**. A validação completa de DDD/telefone ocorrerá na importação; tamanho correto não comprova WhatsApp ativo.
- Não foram encontrados campos vazios nas variáveis B e C. O usuário declarou que todos esses contatos autorizaram mensagens por WhatsApp.
- Há cópias cadastradas como Utility/aprovadas do template `fins_de_atualizacao_cadastral`, com duas variáveis e botões **SIM, CONFIRMO. / NÃO / SAIR**. A aprovação será conferida na instância remetente antes de cada envio.
- A recuperação cadastral está ativa com teto autorizado de **R$20,30/dia**. Seu fluxo atual usa AQUECIMENTO; a nova fonte Novo Mundo será identificada separadamente para aparecer na **PADRÃO**, sem deslocar as conversas antigas ou mudar o fluxo Google Maps/UAZAPI.

**Importante:** o retorno observado a YELLOW é um sinal a acompanhar, não prova de que a campanha causou a melhora. Não existe quantidade garantida de mensagens para alcançar GREEN; os envios serão atualizações cadastrais legítimas para contatos autorizados, sem contornar restrições Meta.

## 1. Nova área em API Oficial Meta → Aquecimento Meta
- Adicionar **Contatos Novo Mundo**, com importação de XLSX, prévia da mensagem, resumo da conferência e confirmação antes de disponibilizar o lote.
- Remover da tela o campo **Números em aquecimento** e os controles que aparecem acima de **Gasto de hoje**, conforme o pedido de deixar essa parte para baixo. Preservar o restante dos painéis e informações; não desligar rotinas nem apagar configurações existentes por remover um campo visual.
- Exibir: **disponíveis para envio, reservados/em processamento, aceitos pela Meta, entregues, respondidos, falhas e descartados**, além da data e situação do último lote.
- Mostrar em destaque **quantos contatos faltam para acabar** e um aviso visual quando restarem 500 ou menos. Disponíveis não inclui inválidos, bloqueados nem já utilizados.
- Oferecer **Ativar/Pausar esta base**, **Atualizar** e **Importar próximo lote**, sem botão de varredura ou envio em massa imediato.

## 2. Importação limitada e segura
- Aceitar arquivos com **até 5.000 linhas de contatos por importação**, além do cabeçalho, e manter **até 5.000 contatos pendentes/reservados no estoque**. Novos lotes podem completar apenas a capacidade livre, sem sobrescrever o saldo anterior.
- O arquivo completo anexado serve para conferência nesta etapa. **Não importar os 115.967 contatos nem começar disparos automaticamente ao aprovar o plano.** Para uso, enviar arquivos separados de até 5.000 contatos; arquivos maiores mostram uma orientação e não publicam importação parcial silenciosa.
- Preservar literalmente os textos de **B → {{1}}** e **C → {{2}}**, sem substituir pela saudação fixa ou pelo nome empresarial usado no fluxo Maps. A coluna C pode conter o nome de uma pessoa.
- Normalizar A com as regras nacionais existentes, conferir DDD, retirar duplicados por sufixo e excluir blacklist, opt-out, confirmados sem WhatsApp e destinatários já consumidos por esta automação.
- Conferir o cabeçalho e exibir quantidades: linhas recebidas, válidas, duplicadas, inválidas, bloqueadas, já utilizadas e efetivamente adicionadas. Valores conflitantes para um mesmo sufixo exigem revisão, sem escolher um nome silenciosamente.
- Registrar a declaração de autorização, responsável, data e origem do lote. Validar também no servidor e publicar cada lote integralmente após conferência, sem deixar uma fila incompleta em caso de falha.
- Lista paginada e processamento em pequenos blocos: a tela não carrega o histórico inteiro. Dados pessoais ficam em armazenamento privado/protegido, nunca em arquivos públicos.

## 3. Utilização automática, sem aumento de volume
- Integrar a nova fonte à recuperação existente, **reutilizando o agendamento**, sem criar outro ciclo recorrente.
- Enquanto esta base estiver ativada, ela será a fonte prioritária para o orçamento de recuperação do proprietário; os envios Maps/UAZAPI não se somam a uma segunda cota. Quando o estoque terminar, **esta base para e aguarda reposição**, sem buscar novos contatos automaticamente por causa dela.
- Somente números nacionais próprios **RED/YELLOW, conectados e aptos após verificação Meta**, sem banimento, bloqueio real, pendência comercial ou pausa protegida, poderão consumir a fila. Consulta inconclusiva não libera remetente.
- Respeitar a janela atual **08h–19h BRT, exceto domingos**, pausas e intervalos aleatórios existentes, cotas oficiais, limite atual por número e **máximo de 20 mensagens/dia por número**, sem elevar configurações mais restritivas.
- Aplicar um único teto financeiro à recuperação: **R$20,30/dia**, não um teto adicional para a nova base. Ao alcançar o limite, aguardar o próximo dia permitido.
- Reavaliar elegibilidade nos ciclos; números que caírem para RED/YELLOW entram automaticamente quando aptos, e números confirmados GREEN deixam de receber trabalho de recuperação. Não alterar suas campanhas manuais.
- Reservar cada contato atomicamente para um único remetente. Não reutilizar o telefone por outra instância, em outro lote ou em outro dia. Após tentativa externa de resultado incerto, não liberar/repetir automaticamente: mostrar a pendência para conferência.
- Enviar somente com cópia **Utility aprovada** na própria instância. Se faltar, mostrar o motivo e aguardar a distribuição/aprovação já existente, sem forçar aplicação em números restritos ou substituir o template.

## 4. Conversas na caixa PADRÃO
- Registrar cada mensagem aceita com telefone, remetente, variáveis realmente enviadas, identificação do lote e horário na **PADRÃO**. Entrega e leitura aparecem apenas após confirmação correspondente, sem confundir aceite com entrega.
- Manter as respostas dessa nova fonte na mesma conversa PADRÃO, inclusive quando o registro chegar primeiro pelo retorno da Meta, evitando duplicação e redirecionamento acidental para AQUECIMENTO.
- Preservar permissões e rodízio dos atendentes elegíveis da PADRÃO. Não atribuir cliente a funcionário por nome da planilha: ela não contém CPF ou responsável.
- Para não mudar atendimento além do solicitado, **não iniciar nova negociação, follow-up ou resposta livre de IA** por conta desta importação. Preservar o agradecimento cadastral único já definido: confirmação explícita → **“Obrigado pela confirmação”**; demais textos ficam visíveis aos atendentes, sem resposta automática desse fluxo.
- **SAIR:** blacklist permanente por sufixo e cancelamento de qualquer envio automático futuro a esse contato, sem resposta. Não alterar o comportamento de conversas sem vínculo com esta fonte.

## 5. Custos e acompanhamento
**Alerta de custo Lovable Cloud:** a nova fila acrescenta armazenamento, validação dos lotes e consultas indexadas. O estoque ativo será limitado a 5.000 contatos, mas registros mínimos de uso e histórico de mensagens crescerão conforme o consumo para impedir repetição e preservar auditoria. O custo Cloud exato depende do uso e não foi medido; não prometer custo zero.

- Manter **R$20,30/dia na Meta** como limite operacional compartilhado, condicionado à tarifa vigente e categoria real; não prometer gratuidade nem subir o volume automaticamente.
- Sem novo cron, consultas sem índice, atualização recorrente adicional ou canal de tempo real. Reutilizar atualizações existentes e leitura sob demanda.
- Medir esta fonte separadamente: aceites, entregas, respostas, saídas e evolução real da qualidade, com data da consulta Meta; preservar métricas antigas e não classificar Novo Mundo como Google Maps.
- A aprovação deste plano autoriza a implementação e o acréscimo de armazenamento/processamento descrito, **não aumento do teto diário nem disparos de teste**. O primeiro lote e sua ativação dependem de confirmação na nova área.

## Detalhes técnicos
- Criar fila/lotes isolados por proprietário, com variáveis 1/2 próprias, estados auditáveis, índices de proprietário/status/ordem e unicidade por sufixo; GRANTs explícitos e RLS, escrita/consumo protegidos no servidor.
- Reutilizar a reserva permanente e supressões existentes sem alterar seu significado para Maps, ajustando apenas os pontos necessários para uma fonte Novo Mundo distinta.
- Integrar importação, consumo, retorno da Meta, roteamento PADRÃO e resumo de estoque. Não mudar globalmente o identificador da caixa AQUECIMENTO.
- Trabalho limitado por execução, trava persistente contra concorrência, progresso idempotente e interrupção em bloqueios externos; fila vazia não cria chamadas ou buscas adicionais.
- Ajustar o painel de gastos para deixar claro o consumo da recuperação/base, evitando apresentar somente números do motor antigo de aquecimento de tier como se fossem desta fila.

## Validação antes de disponibilizar
- Testar 5.000 contatos aceitos, 5.001 rejeitados, capacidade restante, reposição sem sobrescrita e ausência de publicação parcial.
- Testar cabeçalho, A/B/C, textos preservados, duplicados/conflitos, telefone inválido, blacklist, SAIR e reimportação após consumo.
- Testar concorrência, retomada e resultado incerto sem duplicar mensagem; compartilhamento do teto e cotas, domingo, horário, GREEN, bloqueio real e template ausente/reclassificado.
- Conferir PADRÃO com mensagens/respostas da nova fonte, sem mudar Maps/UAZAPI ou conversas existentes; checar permissões e agradecimento único.
- Conferir contadores e atualização após importação/consumo, tela em diferentes tamanhos e erros reais da aplicação.
- **Testes e simulações sem salvar os 115.967 contatos, enviar WhatsApp real ou alterar qualidade artificialmente.**