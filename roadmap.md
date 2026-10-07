# Formalização obrigatória de acordos
- [x] Confirmar o telefone real antes de gravar acordos em todos os lançamentos.
- [x] Exigir envio pela conversa oficial da negociação ou download do termo para finalizar.
- [x] Reabrir automaticamente formalizações interrompidas e termos após alteração do telefone.
- [x] Localizar a conversa Meta pelo telefone confirmado e permitir escolher quando houver mais de uma.
- [x] Corrigir a localização protegida da conversa e pré-selecionar a ocorrência mais recente para envio do termo.

# Roadmap
- [ ] Atualizar portal público para Souza e Ribeiro e três carteiras separadas, preservando Novo Mundo.
- [ ] Validar fonte do principal Odres e autorização de custo da consulta pública UME antes de habilitar propostas.
- [ ] Testar cálculos, isolamento por credor e apresentação do portal sem envios reais.
- [x] Registrar autorização da continuação temporária, limitada a três horas e encerrada ao concluir; validar variáveis, GREEN obrigatório, deduplicação e busca por conteúdo sem envios reais.
- [ ] Conferir ativação na tela autenticada e iniciar lembretes D+1/D+3/D+7 após revisão final da prévia; teste permanece na tela de login apesar de sessão renovada válida. Nenhuma configuração ativa ou mensagem enviada.
- [x] Ampliar busca HSM no Envio Meta para nome e conteúdo, preservando favoritos; testes passaram.
- [x] Corrigir abertura de Instâncias do disparo; painel permaneceu aberto durante atualizações reais no login de Guilherme, fechou e reabriu pelo teclado sem erros ou alteração de envios.
- [x] Recolher e expandir a lista lateral de abas com controle externo sempre acessível e preferência por usuário; testes de isolamento, persistência e armazenamento indisponível passaram, e navegador confirmou espaço liberado, recarregamento e reabertura por teclado sem erros.
- [x] Mostrar campanhas compartilhadas na página e acompanhar ao vivo com cache de resultados e rechecagem de acesso; Guilherme validado no diálogo real, leituras iguais ao proprietário e comandos negados. Revogação real não executada para preservar o acesso solicitado.
- [x] Exibir total/lista de instâncias aprovadas por HSM e compartilhar cada campanha somente para leitura; 12 testes passaram, consultas autenticadas verificadas e diálogo compartilhado simulado sem conceder acessos reais.
- [x] Reduzir esperas internas da campanha, manter intervalo global mínimo de 1s e explicar pausas; funções publicadas, 18 testes passaram. Amostra após correção: 3,08s, 400 envios reais, zero erros/duplicatas; 1/s ainda limitado pelo processamento e RateLimit externo.
- [x] Reativar RED/YELLOW pelo Inbox com confirmação, permissões atuais e consulta individual; 15 testes e diálogo visual validados sem envios ou reativações reais.
- [x] Exibir e exigir todas as variáveis dos templates no início/reabertura de conversas Meta; prévia, limpeza ao trocar e parâmetros validados nos dois diálogos, 21 testes passaram, sem envios reais.
- [x] Corrigir estimativa por remetente/categoria, separar total de envios e incluir a primeira linha sem cabeçalho; 13 testes e importação visual de três clientes validados sem disparos.
- [x] Corrigir timeout da sincronização diária Meta sem novos agendamentos; testes de espera e tela validados, sem aplicar templates nos testes.
- [x] Trocar imagem no HSM somente para a campanha, autorizar arquivos pessoais e validar sem disparos reais.
- [x] Catálogo Utility antes da seleção de instâncias, aplicação de faltantes, deduplicação e testes sem disparos reais.

- [x] Aplicar o link salvo aos novos envios e pendentes, validar destinos e preservar histórico.

- [x] Fixar o link dinâmico escolhido na campanha e mostrar o destino real no botão da conversa; validar sem disparos.

- [x] Criar base e configuração separadas para candidatos a resposta automática.
- [x] Implementar captação diária de até 200 WhatsApps novos em todo o Brasil.
- [x] Priorizar alvos na proporção 70/20/10 e preservar limites das contas Google.
- [x] Criar painel paginado com métricas, filtros, exportação e status de teste.
- [x] Promover automaticamente candidatos confirmados para a lista existente.
- [x] Publicar e validar funções; nenhum envio de mensagem foi executado.
- [x] Validar compilação e responsividade estrutural da tela em desktop e celular.
- [x] Manter 650 consultas diárias e controlar a franquia mensal por conta, sem bloqueio diário em dólares.
- [x] Exibir meta, faltantes, progresso e motivo de encerramento diário.
- [x] Configurar 5.000 consultas mensais e corte preventivo de 4.750 em cada conta Google.
- [x] Restringir o contador do Inbox Meta às conversas não lidas da caixa Padrão.
- [x] Preparar migração atômica da Novo Mundo 3144 para UAZAPI, preservando histórico e vínculo com a Padrão.
- [ ] Executar a migração da Novo Mundo 3144 após a nova conexão UAZAPI ser criada e validada.
- [x] Registrar números confirmados sem WhatsApp e removê-los automaticamente das novas listas do Envio Meta.
- [x] Avisar parcelas atrasadas às 9h e 15h BRT, uma vez por janela, com acesso direto ao acordo e exibição em Retornos.
- [x] Corrigir o aviso travado de templates e completar HSM Utility aprovados apenas nas instâncias GREEN do mesmo dono.
- [x] Corrigir a calculadora UME: à vista sem juros e acréscimo de 10% somente no parcelamento.
- [x] Adicionar Odres Cred aos acordos e aplicar a nova comissão dos funcionários desde 01/10/2026, preservando pagamentos históricos.
- [x] Acelerar a calculadora UME com consulta essencial, tabelas sob demanda, limite de espera e medição por etapa.
- [x] Restaurar etiquetas automáticas por rodízio, com IAGO somente na Padrão, e carregar todas as conversas não lidas.
- [x] Adicionar o modelo de mensagem da Odres Cred com o mesmo cálculo da UME e texto independente.
- [x] Liberar o IAGO para responder todas as entradas UAZAPI da AQUECIMENTO, sem humano e sem follow-up.
- [x] Antecipar o reaquecimento RED/YELLOW para 8h BRT e interromper números com bloqueio real da Meta.
- [x] Permitir bloquear contatos confirmados do Google Maps diretamente no Aquecimento Meta.
- [x] Liberar Utility selecionados em novas instâncias Meta UNKNOWN seguras, com fila sequencial e limite tier 250; avaliar bloqueios confirmados da BM AUREON antes de enfileirar.
- [x] Preservar a seleção ao colar listas simples no Envio Meta, substituindo o trecho selecionado sem misturar contatos antigos.
- [x] Permitir ao Bruno ler e enviar PDFs nas conversas autorizadas e distinguir erros de anexo de erros da Meta.
- [x] Exibir formatos recebidos pela Meta sem `[unsupported]` e preservar diagnóstico seguro de novos tipos desconhecidos.
- [x] Manter conversas do Inbox Meta como não lidas até uma resposta ser enviada com sucesso.
- [x] Isolar envios e etiquetas de atendentes pela caixa autorizada e corrigir etiquetas antigas incompatíveis.
- [x] Atualizar a saúde antes de aplicar templates, explicar o bloqueio Meta 141006 e reconhecer instâncias já completas.
- [x] Recuperar importações Cobmais travadas em 5%, processar planilhas grandes em lotes e publicar automaticamente após validação integral.

- [x] Revalidar pagamento antes dos avisos Meta, separar resultados inconclusivos e validar/publicar sem envios reais; 19 testes passaram.
