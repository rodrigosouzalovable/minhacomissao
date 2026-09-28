# Piloto de renovação anual e aplicação automática de templates

## Objetivo

Executar, de **28/09/2026 a 02/10/2026**, um piloto diário com empresas dos CNAEs já definidos que abriram o CNPJ **na mesma data, exatamente um ano antes**. Cada instância Meta marcada e apta poderá receber até **50 novos números de WhatsApp por dia**, e a Clara atenderá as respostas oferecendo a renovação do certificado digital nas condições atuais.

Também corrigir o comando **Templates > Aplicar templates** no card da API Oficial Meta para iniciar de fato a aplicação dos templates cadastrados naquela instância.

## Captação anual da Casa dos Dados

- Durante o piloto, substituir a seleção atual D+5 a D+30 pela data-calendário de um ano antes: em 28/09/2026 buscar 28/09/2025, em 29/09/2026 buscar 29/09/2025, e assim sucessivamente.
- Manter os CNAEs já definidos: psicologia, odontologia, contabilidade e consultoria.
- Rodar somente de segunda a sexta, aproveitando a rotina diária existente das 09:00 BRT, sem criar novo agendamento ou consulta contínua.
- Somar as metas individuais das instâncias marcadas e aptas; captar e confirmar WhatsApp até completar **50 novos contatos por instância**, descontando o que já estiver reservado ou enviado no dia.
- Usar primeiro o estoque local elegível daquela data exata e consultar a Casa dos Dados apenas para completar o saldo faltante.
- Manter deduplicação por CNPJ e pelos últimos 8 dígitos do telefone, blacklist, opt-out e bloqueio de contatos já usados.
- Participarão somente instâncias com aquecimento ativado, conectadas, no pool, sem restrição, com qualidade GREEN/UNKNOWN e template aprovado.
- Encerrar automaticamente esse modo anual após 02/10/2026, preservando os resultados e sem voltar a disparar o piloto antigo silenciosamente.

## Campanha e acompanhamento

- Criar ou complementar uma campanha diária identificada como **Renovação Certificado — 1 ano — data**.
- Distribuir os contatos de forma equilibrada, respeitando a meta individual de cada instância e os intervalos aleatórios já existentes de 30 a 90 segundos.
- Mostrar no card de cada instância o progresso diário já existente, agora referente ao piloto anual.
- Registrar enviados, entregues, lidos, respostas, interessados, recusas, números errados, opt-outs e transferências humanas.
- Apresentar ao final da semana um comparativo diário e por CNAE, sem misturar resultados do piloto anterior D+5 a D+30.

## Clara para renovação

- Identificar a conversa como originada do piloto de CNPJ com um ano, usando o envio vinculado ao contato e não apenas o texto recebido.
- Na primeira resposta elegível, explicar que o contato é para verificar a **renovação do certificado digital** da empresa.
- Manter a condição já definida: certificado digital **PJ A1 por R$ 129,90**.
- Preservar o fluxo atual de interesse, agendamento, coleta de CNPJ/e-mail/CNH, confirmação e encaminhamento ao humano.
- Preservar recusa, número errado, blacklist/opt-out, interrupção quando houver atendente humano e aviso administrativo com a etiqueta **Aguardando Humano**.
- Não afirmar que o certificado venceu; oferecer renovação e encaminhar dúvidas sobre validade ou situação específica ao humano.

## Templates no card da API Oficial Meta

### Diagnóstico confirmado

Hoje, **Templates > Aplicar templates** chama apenas a sincronização dos templates que já existem na Meta. Ele atualiza a lista local, mas não inicia a cópia dos templates cadastrados para a instância.

### Correção

- Ao clicar em **Aplicar templates**, primeiro sincronizar os templates reais da instância para evitar duplicidades.
- Em seguida, enfileirar automaticamente os templates mestres já cadastrados e marcados para aplicação em novos números.
- Não reenviar nome + idioma que já esteja aprovado, pendente ou em análise nessa instância.
- Permitir a submissão das categorias já liberadas no cadastro, inclusive MARKETING, sem usar essa liberação para disparar mensagens a clientes; modelos estruturalmente incompatíveis ficam fora e terão motivo visível.
- Manter processamento gradual, horário de 07:00 a 20:00 BRT, bloqueio aos domingos, limite de tier 250 e pausas diante de recusas ou limites reais da Meta.
- Exibir confirmação com quantidade enfileirada, quantidade já existente e motivo quando não houver modelo pendente; manter o progresso no badge do card.

## Validação

- Simular cada data do piloto e confirmar que somente a data de abertura correspondente a um ano antes é selecionada.
- Confirmar 50 novos contatos por instância apta, saldo diário, deduplicação e ausência de contatos das janelas D+5 a D+30.
- Validar a resposta da Clara para renovação, preço de R$ 129,90, recusa, opt-out e entrega ao humano.
- Clicar em **Aplicar templates** em uma instância com modelos faltantes e confirmar criação da fila e início do processamento; repetir em uma instância completa e confirmar que nada é duplicado.
- Validar tela, funções publicadas, permissões e registros sem criar disparos de teste para clientes.

## Custo autorizado e proteção

Foi autorizado o volume de **50 novos números por instância apta, por dia útil, durante esta semana**. Isso aumenta proporcionalmente as consultas à Casa dos Dados, verificações UAZAPI, mensagens Meta e respostas da Clara. Para reduzir desperdício, o sistema priorizará estoque local, buscará somente a data anual exata, descontará o saldo já utilizado e não criará novo agendamento, polling ou canal em tempo real.
