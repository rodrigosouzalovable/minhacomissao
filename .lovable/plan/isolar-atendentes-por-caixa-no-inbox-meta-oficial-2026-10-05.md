# Isolar atendentes por caixa no Inbox Meta Oficial

## Diagnóstico confirmado

- O cliente **Espetinho do Mestre** possui duas conversas distintas porque escreveu para dois números oficiais:
  - uma conversa na **Padrão**, atualmente atribuída corretamente a **Anna Flavia**;
  - outra na **ODRES-Entradas**, atribuída a **Andreia**.
- A mensagem azul de Andreia exibida no print é histórica: foi enviada em **30/09** pela instância que hoje aparece na Padrão. Ela continua no histórico do cliente, mas não representa a atribuição atual do card.
- Andreia está ativa somente em **ODRES-Entradas** e **ODRES-Vencido**; ela não é membro da Padrão.
- Existem **92 conversas antigas da Padrão** ainda com etiqueta de Andreia, além de outras etiquetas antigas incompatíveis com suas caixas atuais.
- O rodízio atual já valida os membros da caixa ao atribuir novas entradas, mas os caminhos de envio não aplicam todos a mesma validação no servidor. O envio de texto, em especial, aceita o usuário informado pela tela sem confirmar sua sessão e sua participação na caixa.

## Correção

### 1. Bloquear atendimento fora da caixa no servidor

- Criar uma validação central e autenticada para qualquer resposta de conversa existente.
- Antes de enviar texto, áudio, imagem, vídeo, documento ou template, confirmar que o usuário conectado:
  - é administrador; ou
  - participa da caixa onde aquela conversa está; e
  - possui permissão ativa para atender o Inbox.
- Na Padrão, aceitar somente membros cadastrados na Padrão; em cada caixa específica, aceitar somente seus membros.
- Ignorar o `user_id` enviado pela tela e usar a identidade real da sessão.
- Retornar um aviso claro e não enviar nada quando o usuário tentar responder fora da própria caixa.
- Preservar os envios internos autorizados do IAGO e das automações, sem permitir que essa exceção seja usada pela tela.

### 2. Proteger todos os formatos

- Aplicar a mesma regra aos três caminhos de envio do Inbox:
  - texto livre;
  - mídias e arquivos;
  - templates usados para reabrir ou iniciar conversa.
- Manter os demais fluxos de campanha e automação com sua finalidade atual, sem misturá-los ao atendimento manual.

### 3. Corrigir etiquetas antigas incompatíveis

- Remover das conversas da Padrão as etiquetas de atendentes que não pertencem mais à Padrão, incluindo as 92 etiquetas antigas de Andreia.
- Fazer o mesmo nas demais caixas quando a etiqueta atual não corresponder a um membro atendente daquela caixa.
- Não apagar mensagens, não alterar o histórico e não mover conversas entre caixas.
- Conversas não lidas que ficarem sem atendente válido entram novamente no rodízio da própria caixa; conversas lidas permanecem sem redistribuição automática.

### 4. Evitar nova inconsistência

- Fortalecer a atribuição atômica para descartar uma etiqueta antiga quando o atendente deixar de pertencer à caixa.
- Validar novamente a elegibilidade da etiqueta atual a cada nova entrada, em vez de considerar apenas que existe alguma etiqueta de atendente.
- Manter o IAGO apenas no rodízio da Padrão e preservar a exceção já definida para respostas UAZAPI da AQUECIMENTO.

## Comportamento do histórico

- A mensagem histórica de Andreia continuará visível na conversa porque foi realmente enviada ao cliente; ocultá-la falsificaria o histórico.
- O card da conversa mostrará somente o atendente válido da caixa atual.
- A partir da correção, Andreia não conseguirá abrir nem responder conversas da Padrão, mas continuará atendendo normalmente suas caixas ODRES.

## Validação

- Entrar como Andreia e confirmar que a Padrão não aparece e que uma tentativa direta de envio é bloqueada no servidor.
- Confirmar que Andreia continua enviando texto, áudio, PDF e template nas caixas ODRES autorizadas.
- Confirmar que membros da Padrão conseguem atender a Padrão e não conseguem responder caixas onde não estão vinculados.
- Conferir que todas as etiquetas inválidas foram removidas e que as não lidas foram redistribuídas apenas dentro da própria caixa.
- Simular nova entrada em conversa com etiqueta incompatível e confirmar a correção automática pelo rodízio correto.
- Não enviar mensagens reais a clientes durante os testes.

## Impacto técnico e custo

- A validação será feita dentro dos envios já existentes e na operação atômica de atribuição.
- A correção das etiquetas atuais será executada uma única vez.
- Sem novo cron, polling, canal em tempo real ou chamada de IA; sem aumento relevante de custo do Lovable Cloud.
