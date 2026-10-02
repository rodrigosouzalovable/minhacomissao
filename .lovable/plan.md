# Importar automaticamente templates Utility em novas instâncias Meta

## Resultado esperado

- Toda nova instância própria da API Oficial Meta, ao ser adicionada ao sistema, recebe automaticamente a fila com todos os templates **Utility** marcados para novas instâncias e pertencentes ao mesmo responsável.
- Qualidade **UNKNOWN/desconhecida** deixa de impedir a importação quando o número está conectado, tem credenciais válidas e não possui bloqueio real.
- Qualidade **YELLOW ou RED**, conta bloqueada/restrita, pendência de pagamento, nome reprovado, instância inativa ou desconectada continuam impedindo a submissão.
- BMs tier **250** mantêm o máximo de **2 templates por número/dia**.
- BMs tier **1.000 ou 2.000** recebem todos os Utility selecionados, sempre **um por vez**, com intervalo aleatório e dentro da janela segura existente; nunca em envio simultâneo no mesmo número.

## Alterações

1. **Corrigir a elegibilidade por qualidade**
   - Permitir `GREEN` e `UNKNOWN` na auditoria, no enfileiramento de números novos e no processador da fila.
   - Manter bloqueio explícito para `YELLOW`, `RED` e situações reais de restrição já reconhecidas pelo sistema.
   - Não tratar falha de leitura de qualidade como autorização automática quando houver erro confirmado; diferenciar `UNKNOWN` legítimo de consulta de saúde indisponível.

2. **Garantir o preenchimento automático em novas instâncias**
   - Após salvar uma nova instância Meta válida, enfileirar automaticamente os templates Utility marcados como “Injetar em números novos”, sem depender de acionamento manual.
   - Preservar isolamento por proprietário, ignorar parceiros e impedir duplicidade por modelo + idioma + instância.
   - Se o cadastro for interrompido ou a fila falhar temporariamente, a auditoria existente deve reencontrar os itens ausentes.

3. **Aplicar ritmo conforme o tier da BM**
   - Tier 250: usar a reserva atômica já existente e manter somente duas submissões por número no dia; excedentes ficam para o próximo dia permitido.
   - Tier 1.000 e 2.000: sem teto diário de templates, mas processando sequencialmente pelo mecanismo atual, com intervalo aleatório de 2–5 minutos entre modelos do mesmo número.
   - Preservar janela de 07h às 20h BRT, bloqueio aos domingos, pausa por limite/bloqueio e pausa após reprovações consecutivas.

4. **Corrigir a BM AUREON agora**
   - Atualizar a leitura dos templates reais das cinco instâncias da BM AUREON.
   - Enfileirar, nas três instâncias principais com cópia automática ativa, todos os Utility selecionados ainda ausentes, incluindo o número `62 8269-3388`, atualmente sem modelos importados.
   - Tratar a AUREON conforme seu tier cadastrado de 1.000: todos os itens entram na fila e seguem um por vez, sem o limite de dois por dia.
   - Não incluir automaticamente os dois números de teste que estão com a cópia automática desligada.

5. **Retorno e conferência**
   - Ajustar os avisos da tela para informar separadamente: enfileirados, já existentes, adiados por tier 250 e bloqueados por qualidade/restrição.
   - Validar que UNKNOWN conectado entra na fila; YELLOW/RED permanece bloqueado; tier 250 não passa de duas reservas; tier 1.000/2.000 não envia simultaneamente.
   - Conferir na BM AUREON quantos Utility foram encontrados, enfileirados, enviados e ficaram aguardando aprovação da Meta.

## Situação confirmada

- A BM AUREON está cadastrada com tier diário de **1.000** e possui cinco instâncias ativas, todas `CONNECTED` com qualidade `UNKNOWN`.
- As três instâncias principais têm a cópia automática ligada; duas já possuem registros de templates e a `62 8269-3388` não possui nenhum.
- Há **16 templates Utility** do mesmo responsável marcados para novas instâncias.
- Hoje a auditoria, o enfileiramento e o processador exigem `GREEN`, por isso bloqueiam todas as instâncias da AUREON.

## Impacto de custo

Esta mudança não cria nova rotina, polling ou canal em tempo real. Ela amplia as submissões feitas pela fila existente para números `UNKNOWN`; na AUREON, podem entrar até 16 Utility por número elegível, um por vez. O impacto esperado é baixo e temporário, limitado às chamadas necessárias para cadastrar os modelos ausentes.

## Detalhes técnicos

- Centralizar a regra de elegibilidade para evitar divergência entre auditoria, cadastro e processamento.
- Reutilizar a fila `meta_templates_onboarding_fila` e a reserva atômica do tier 250.
- Preservar a conferência final antes da submissão e o bloqueio de modelos Marketing ou reclassificados.
- Atualizar a decisão técnica do projeto: sincronização automática aceita GREEN e UNKNOWN seguro; YELLOW/RED aguardam liberação.
