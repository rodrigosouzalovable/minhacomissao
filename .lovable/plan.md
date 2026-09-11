# Nova aba Campanhas e colagem inteligente do Excel

Criar uma página completa de histórico de campanhas Meta na lateral esquerda. Administradores e parceiros Meta poderão acessá-la, mas cada login verá somente as campanhas que ele próprio iniciou.

## Alerta de custo do Lovable Cloud

Esta mudança adiciona consultas paginadas ao histórico e aos detalhes das campanhas. O impacto esperado é **baixo**, porque não haverá novo agendamento, polling contínuo ou canal em tempo real. A listagem carregará apenas a página visível, com filtros executados no banco e índices para evitar leituras desnecessárias.

## Aba Campanhas

- Adicionar **Campanhas** ao menu lateral e uma rota protegida para administradores, parceiros Meta e usuários que já possuem a permissão “Ver painel de Campanhas”.
- Manter o botão flutuante atual para acompanhamento rápido; a nova página será o histórico completo.
- Garantir no acesso e nas consultas que cada usuário veja somente campanhas do próprio login.
- Exibir campanhas em tabela paginada, incluindo nome, período, status, template, caixa/pasta, instâncias usadas, total, enviados, entregues, lidos, erros, bloqueados e custo.
- Adicionar filtros combináveis por:
  - período inicial e final;
  - nome da campanha;
  - pasta/caixa do Inbox;
  - número ou nome da instância Meta;
  - status da campanha.
- Tratar campanhas antigas sem pasta vinculada como **Caixa padrão / não informada**, sem escondê-las dos resultados.

## Detalhes completos

- Reutilizar e ampliar a tela de detalhes existente, preservando progresso, duração, template, desempenho por instância/BM, entregas, leituras, respostas, acordos, valores e erros.
- Mostrar os contatos retirados pela blacklist, os ignorados por envio recente, os números sem WhatsApp e as falhas, com as exportações já disponíveis.
- Exibir a pasta do Inbox e todas as instâncias Meta utilizadas naquela campanha.
- Acrescentar um resumo financeiro com mensagens cobradas/gratuitas, valor em dólar, cotação aplicada e valor em reais.
- Para campanhas novas, gravar a referência de preço/câmbio usada no cálculo para o histórico não mudar depois.
- Para campanhas antigas, reconstruir o valor quando houver dados suficientes; quando não houver, mostrar **Estimativa indisponível** em vez de apresentar um valor inexato.
- Como a Meta disponibiliza cobrança consolidada por conta/dia, identificar o valor da campanha como **custo calculado da campanha**, sem apresentá-lo como fatura exata quando não existir atribuição individual por mensagem.

## Colagem direta do Excel em Envio Meta

- Interceptar a colagem no campo de destinatários e reconhecer automaticamente o formato tabulado copiado do Excel.
- Converter cada linha e coluna da área copiada para a estrutura já usada pelo mapeador, sem quebrar células vazias ou linhas com várias colunas.
- Abrir automaticamente a tela **Definir informações dos destinatários** após a colagem para o usuário indicar Telefone, Nome, CPF/CNPJ, Credor e variáveis do template.
- Depois da confirmação, preencher o campo com as informações separadas corretamente por vírgulas e manter a prévia em tabela.
- Preservar a digitação manual atual, a importação de arquivo Excel e as validações obrigatórias de CPF/credor.
- Disponibilizar o comportamento para parceiros Meta e para qualquer outro usuário autorizado a usar Envio Meta, evitando comportamentos diferentes na mesma tela.

## Detalhes técnicos

- Criar a página de campanhas, registrar a rota e incluir a regra específica de visibilidade no menu lateral.
- Reaproveitar `CampanhaDetalheDialog`, `CampanhaResultadoCard` e `CampanhaInstanciasPanel` em vez de duplicar controles e cálculos.
- Consultar `envio_meta_job` com filtro obrigatório pelo usuário autenticado e paginação no banco; usar `folder_id`, `instancia_ids` e as tabelas de pastas/instâncias para os dois filtros de caixa solicitados.
- Estender o resumo de resultado da campanha para guardar os campos financeiros necessários, com migração, permissões e políticas mantendo o isolamento por proprietário.
- Adicionar índices somente nos campos usados pela listagem e filtros, evitando consultas integrais.
- Implementar o tratamento de `text/tab-separated-values` no evento de colagem do campo de destinatários e encaminhar as matrizes de células ao mapeador existente.

## Validação

- Testar separadamente um administrador e um parceiro Meta, confirmando que cada um vê somente as próprias campanhas e consegue abrir os detalhes.
- Validar filtros de período, nome, pasta e instância, incluindo campanhas antigas sem pasta.
- Conferir totais, blacklist, instâncias, resultados e custo em campanhas reais recentes.
- Colar exemplos do Excel com cabeçalho, sem cabeçalho, células vazias, CPF, credor e variáveis; confirmar que o mapeamento e a saída por vírgulas permanecem corretos.
- Verificar navegação e layout em computador e celular, além da compilação e dos registros de erro.
