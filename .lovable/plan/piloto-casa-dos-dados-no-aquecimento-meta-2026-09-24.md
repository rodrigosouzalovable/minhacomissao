# Piloto Casa dos Dados no aquecimento Meta

## Objetivo
Pausar, de forma reversível, a entrada de novos leads pelo Google Maps e testar o aquecimento dos números de novas BMs com empresas da Casa dos Dados, usando a caixa CERTIFICADO e atendimento exclusivo da Clara.

## Fluxo proposto
1. **Pausar Google Maps**
   - Interromper a captação automática e desabilitar a busca manual de novos leads.
   - Preservar todo o histórico e os leads já armazenados.

2. **Preparar o público do teste**
   - Usar primeiro o estoque local de empresas com WhatsApp confirmado.
   - Consultar a Casa dos Dados somente quando o estoque elegível não completar o limite diário.
   - Trabalhar uma faixa por dia útil: D+5, D+10, D+15, D+20, D+25 e D+30.
   - Manter deduplicação por telefone, bloqueios e opt-outs.

3. **Enviar o template correto**
   - Fixar o template `cnpj_atualizado_2`, em português.
   - Preencher a única variável com: `falo com o(a) responsável por NOME DA EMPRESA?`
   - Resultado atual do template: `Olá falo com o(a) responsável por NOME DA EMPRESA? informamos que o processo de emissão do seu CNPJ foi atualizado.`
   - Usar somente números marcados como “Número de nova BM — entrar no aquecimento de tier”, conectados, disponíveis no pool e com esse template aprovado.

4. **Operação controlada**
   - Limite de 50 contatos por dia útil.
   - Intervalos aleatórios de 30 a 90 segundos.
   - Toda conversa entra na caixa CERTIFICADO e fica atribuída à Clara.
   - O modo ficará pausado até a validação final da prévia; nenhum envio será iniciado automaticamente nesta alteração.

5. **Clara como vendedora de certificados**
   - Interpretar cada resposta antes de agir, inclusive negações, dúvidas, objeções, número errado e pedido de bloqueio.
   - Responder de forma consultiva e profissional, avançando para agendamento e documentos somente quando houver intenção compatível.
   - Encaminhar para atendimento humano nos casos sensíveis ou fora do escopo.
   - Evitar respostas duplicadas: na caixa CERTIFICADO, somente a Clara atende automaticamente.

6. **Mensurar o piloto**
   - Exibir por faixa: enviados, entregues, respostas, interessados, recusas, números errados, opt-outs e transferências humanas.
   - Calcular taxa de resposta e taxa de interesse.

## Detalhes técnicos
- Reaproveitar o agendamento existente, sem criar novo cron ou polling.
- Manter RLS, permissões, supressão e auditoria existentes.
- Registrar a resposta e sua classificação no envio do Certificado Digital.
- Usar o modelo de IA padrão do projeto para a interpretação da Clara, com uma chamada somente quando houver resposta recebida.
- Implantar e testar as funções afetadas, sem disparar a campanha.