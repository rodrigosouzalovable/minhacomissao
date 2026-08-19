# Corrigir pop-up de retorno + histórico no ícone do relógio

## Por que o alerta das 16h08 não apareceu

Confirmei no banco: o retorno do "Rodrigo" ficou salvo como `19:08 UTC`, que é exatamente 16h08 de Brasília (correto). Já os retornos antigos, criados na página Retornos, foram salvos com a hora local gravada como se fosse UTC (ex.: `14:12+00` para um retorno de 11h12).

O verificador do pop-up (`RetornoAlertChecker`) foi escrito para o padrão antigo: ele desloca a janela de busca em 3 horas. Com o agendamento novo (hora correta em UTC), ele procurou o retorno por volta de 22h08 UTC e por isso nada apareceu na tela.

## O que vai mudar

1. **Padronizar a hora dos retornos**
   - O verificador passa a comparar em UTC real, sem o deslocamento de 3 horas.
   - A página Retornos passa a salvar data+hora convertidas corretamente para UTC.
   - Os retornos pendentes antigos (gravados com hora local no lugar de UTC) são corrigidos uma única vez, somando o deslocamento, para não dispararem em horário errado.

2. **Pop-up mais confiável**
   - Janela de checagem ampliada: pega retornos vencidos nos últimos 60 minutos (antes eram só 5), então mesmo se a aba estiver fechada/oculta no minuto exato, o alerta aparece assim que você volta ao sistema.
   - Se houver mais de um retorno vencido, eles são mostrados em fila, um após o outro.
   - No pop-up, além de nome/CPF/telefone/observação, entram a hora agendada e dois botões: "Entendido" (fecha) e "Marcar como concluído" (baixa o retorno).

3. **Histórico ao clicar no relógio (Inbox Meta Oficial)**
   - O dialog do relógio ganha duas abas: **Agendar** (o formulário atual) e **Histórico**.
   - O Histórico lista os retornos do contato da conversa e, abaixo, os seus retornos em geral, separados em **Próximos** (datas futuras) e **Passados** (já vencidos ou concluídos), com data/hora, observação e status (pendente / atrasado / concluído).
   - Cada item pendente pode ser marcado como concluído ali mesmo.

## Detalhes técnicos

- `src/components/RetornoAlertChecker.tsx`: remover o ajuste `getTimezoneOffset`, usar janela `[agora-60min, agora+2min]` em UTC, manter poll de 2 min com guarda de visibilidade (sem custo extra de backend), enfileirar múltiplos alertas e adicionar ação de `update status='concluido'`.
- `src/pages/Retornos.tsx`: montar a data com `new Date(\`${data}T${hora}:00\`).toISOString()` (quando houver hora) para gravar UTC real.
- `src/components/inbox/meta/AgendarRetornoDialog.tsx`: envolver o conteúdo em `Tabs` (Agendar / Histórico); nova consulta em `retornos` filtrada por `user_id`, com destaque para o telefone do contato via sufixo de 8 dígitos.
- Correção pontual dos dados existentes via update em `retornos` (apenas linhas `status='pendente'` criadas no formato antigo), sem alteração de schema.
