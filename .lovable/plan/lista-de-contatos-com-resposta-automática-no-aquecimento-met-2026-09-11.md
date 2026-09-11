# Lista de contatos com resposta automática no Aquecimento Meta

## Objetivo

Criar, em **API Oficial Meta → Aquecimento Meta**, uma lista permanente dos leads do Google Maps cujo WhatsApp respondeu automaticamente. A lista cresce a cada nova resposta confirmada e poderá ser reutilizada futuramente.

## O que será feito

1. **Identificar a resposta automática na chegada**
   - Aproveitar o recebimento da mensagem que já marca o lead como respondido.
   - Classificar como automática apenas quando o texto tiver sinais claros de atendimento automático, como agradecimento pelo contato, ausência, horário de atendimento, pedido padronizado de dados ou aviso de retorno.
   - Usar o tempo de resposta apenas como evidência complementar; uma resposta rápida como “Não” ou “Boa tarde” não será classificada sozinha como automática.
   - Manter o IAGO desligado para esses leads, como já ocorre hoje.

2. **Guardar uma base deduplicada e auditável**
   - Criar uma tabela própria com um registro por telefone normalizado, evitando duplicações mesmo quando o formato do número mudar.
   - Guardar telefone, lead de origem, empresa, nicho, cidade, primeira e última detecção, quantidade de respostas automáticas, texto mais recente e motivo/confiança da classificação.
   - Quando o mesmo contato responder automaticamente de novo, atualizar o registro e incrementar o contador.
   - Proteger a tabela para acesso administrativo e conceder somente os acessos necessários ao sistema.

3. **Adicionar o novo campo na tela**
   - Criar o card **“Contatos com resposta automática”** dentro de Aquecimento Meta.
   - Mostrar total acumulado, telefone, empresa, nicho/cidade, quantidade de ocorrências, última detecção e uma prévia da resposta.
   - Incluir busca, paginação, botão para copiar os telefones e exportação em Excel para uso futuro.
   - Exibir estado vazio claro enquanto nenhum contato for confirmado.

4. **Aproveitar o histórico existente**
   - Reavaliar uma única vez as respostas históricas já recebidas e preencher a lista somente com casos que atendam aos mesmos critérios.
   - Hoje há **147 respostas registradas de 133 contatos distintos**; 99 ocorreram em até dois minutos, mas elas serão tratadas apenas como candidatas até o texto confirmar que eram automáticas.

5. **Atualizar o aprendizado do aquecimento**
   - Fazer o ranking por nicho/cidade contar como “resposta automática” somente os contatos confirmados por essa classificação, em vez de considerar qualquer resposta rápida como robô.
   - Preservar separadamente a métrica geral de respostas, sem perder o histórico atual.

## Segurança e custo

- Nenhum novo cron, polling ou consulta periódica será criado.
- A classificação ocorrerá no fluxo de resposta que já existe, com um único `upsert` indexado apenas quando uma resposta automática for confirmada.
- A tela carregará a lista com paginação e cache, evitando leitura integral da base.

**⚠️ Alerta de custo Lovable Cloud:** haverá uma pequena gravação adicional somente quando uma resposta automática for identificada. O impacto estimado é mínimo, sem consumo contínuo. A aprovação deste plano confirma essa alteração de baixo impacto.

## Detalhes técnicos

- Nova tabela pública com `GRANT`, RLS administrativa e índice/unicidade pelo telefone normalizado.
- Extrair o detector de resposta automática para um helper compartilhado entre o webhook e o aprendizado, evitando regras diferentes.
- Integrar a gravação após o vínculo existente por instância + sufixo de 8 dígitos no webhook Meta.
- Criar uma operação única e idempotente para a classificação do histórico.
- Atualizar `AquecimentoMetaTab` com consulta paginada, busca, cópia e Excel.
- Validar com casos automáticos reais e respostas humanas curtas para evitar falsos positivos.
