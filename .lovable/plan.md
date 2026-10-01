# Captação inteligente de leads com provável resposta automática

## Resultado esperado
- Captar automaticamente, em Goiás, até **200 números novos com WhatsApp confirmado por dia**.
- Priorizar empresas com maior probabilidade de responder automaticamente, aprendendo com os 649 contatos confirmados já vinculados ao Google Maps.
- Criar, em **API Oficial Meta → Aquecimento Meta**, abaixo de **Contatos com resposta automática**, o campo **Candidatos a resposta automática**.
- Permitir baixar os candidatos em Excel para testes externos.
- Quando uma resposta automática for confirmada pelo sistema, retirar o número dos candidatos e incluí-lo automaticamente na lista de confirmados.

## Como a seleção será feita
1. Consolidar nomes equivalentes de nichos e cidades para evitar rankings fragmentados.
2. Calcular uma pontuação por nicho e cidade considerando:
   - taxa histórica de respostas automáticas;
   - quantidade mínima de empresas testadas;
   - recência dos resultados;
   - presença de site, nota e volume de avaliações como sinais complementares;
   - penalização por reclamações, números inválidos e baixa confiança.
3. Distribuir a busca diária em:
   - **70%** nos segmentos comprovadamente melhores;
   - **20%** em segmentos intermediários promissores;
   - **10%** em novos testes, para o sistema continuar aprendendo.
4. Deduplicar por Place ID, telefone completo e últimos 8 dígitos, excluindo números já captados, confirmados, bloqueados, retirados ou testados recentemente.
5. Parar a coleta do dia assim que atingir 200 novos WhatsApps confirmados ou o teto de segurança de consultas.

## Novo campo “Candidatos a resposta automática”
- Mostrar total disponível, data da captação, empresa, telefone, nicho, cidade, nota, avaliações e motivo da pontuação.
- Incluir busca, filtros, paginação e estados claros: **Novo**, **Exportado**, **Em teste** e **Confirmado**.
- Botão **Baixar Excel** com Nome, Telefone, Empresa, Nicho, Cidade e Data da captação.
- Registrar quais números foram exportados, sem repetir candidatos no próximo arquivo por padrão.
- Não enviar mensagens automaticamente por este campo; o envio de teste continuará sob seu controle.

## Transferência automática para confirmados
- Aproveitar o detector e o registro idempotente já existentes.
- Ao confirmar uma resposta automática, marcar o candidato como confirmado e vinculá-lo à lista atual de **Contatos com resposta automática**.
- Evitar duplicidade quando o mesmo número responder novamente ou aparecer com formatação diferente.
- Manter histórico de captação, exportação, primeira confirmação, texto detectado e confiança.

## Automação diária e segurança
- Criar uma configuração própria para esta captação, separada da antiga captação de aquecimento, que continuará pausada.
- Reutilizar a execução diária existente, com trava contra execução duplicada e lotes limitados; não criar monitoramento contínuo.
- Executar somente em dias e horário comercial configurados, retomando de onde parou se houver falha temporária.
- Interromper após erros definitivos, limite de chave ou teto diário; exibir no painel o motivo e permitir retomada administrativa.
- Respeitar o bloqueio mensal de cada conta Google e escolher somente contas disponíveis.

## Acompanhamento
- Exibir no novo campo: meta diária, captados hoje, consultas usadas, taxa WhatsApp, candidatos exportados, confirmados e taxa real de resposta automática.
- Mostrar desempenho por nicho/cidade e comparar previsão versus confirmação real.
- Usar os resultados confirmados para atualizar o ranking dos próximos dias, sem considerar uma resposta humana comum como automática.

## Custo e limites
**⚠️ Alerta de custo Google Maps / Lovable Cloud:** esta opção reativa uma coleta automática diária e gera uso recorrente. Cada página de busca custa aproximadamente **US$ 0,032** antes de eventuais franquias do Google. Com o teto atual de 650 consultas, o limite teórico é cerca de **US$ 20,80 por dia** (aproximadamente **US$ 624 em 30 dias**), embora a rotina pare antes ao alcançar os 200 WhatsApps. A verificação de WhatsApp usa UAZAPI e não adiciona consultas Google.

- Preservar o teto atual de 650 consultas/dia e 950 consultas/mês por conta.
- Mostrar consumo e custo estimado no painel.
- Não ultrapassar automaticamente os limites para tentar completar a meta.
- A aprovação deste plano autoriza a captação automática diária específica de candidatos; não autoriza reativar campanhas, Clara, Certificado ou envios automáticos.

## Detalhes técnicos
- Nova tabela de candidatos com `GRANT`, RLS administrativa, chave única por telefone normalizado e índices para status/data/nicho/cidade.
- Nova operação administrativa paginada para listar e exportar candidatos sem carregar toda a base de uma vez.
- Rotina diária limitada, idempotente e com trava única para selecionar alvos, chamar a busca existente, verificar WhatsApp e gravar apenas leads inéditos.
- Origem própria para separar esta coleta das buscas manuais e do abastecimento antigo.
- Integração da confirmação com `registrar_auto_resposta_geral`, promovendo o candidato na mesma transação lógica.
- Validação final sem envio real: deduplicação, limite diário, Excel, promoção automática simulada, RLS e visualização em desktop e celular.
