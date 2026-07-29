Plano para corrigir o uso de CPU que continuou em 100%

1. Reduzir a carga real que ainda está batendo no banco
- Corrigir a busca pesada de nomes no Inbox Meta: hoje ela faz busca por telefone com `ilike '%sufixo'` na tabela `devedores`, que tem cerca de 750 mil registros e apareceu rodando agora no banco.
- Trocar essa busca para usar a tabela já específica de telefones vinculados ao CPF (`devedor_telefones`) ou uma função otimizada por sufixo, evitando varrer a tabela gigante de devedores.
- Manter a regra do sistema: comparação por sufixo/últimos 8 dígitos.

2. Diminuir o impacto do monitoramento de campanhas Meta
- Parar de pré-carregar automaticamente itens e logs de campanhas fechadas/última campanha assim que a página abre.
- Carregar detalhes completos somente quando o usuário abrir o diálogo da campanha.
- Para campanhas rodando, buscar só contadores/status com intervalo maior e buscar itens em lotes apenas quando necessário.

3. Ajustar consultas de logs de envio Meta
- Limitar a consulta `meta_whatsapp_envios_log` ao período e aos telefones realmente presentes na campanha aberta, em vez de ler até 5000 logs do usuário a cada atualização.
- Manter status de entrega visível, mas com menos leitura repetida.

4. Corrigir pontos restantes de refetch frequente
- Aumentar/condicionar os refetches de metas, motivação e lembretes que consultam `pagamentos`, usando `visibilityState` para não rodar em aba oculta.
- Revisar os pontos com intervalo de 2 a 5 minutos que podem estar abertos em várias abas.

5. Banco de dados
- Criar índice/função otimizada somente se necessário para a busca por telefone, com foco em não aumentar custo.
- Não vou propor upgrade de instância agora porque o diagnóstico atual mostra memória baixa, conexões moderadas e disco normal; o gargalo ainda parece ser consulta repetida/pesada.

Validação após implementar
- Rodar novamente o diagnóstico de saúde e consultas lentas.
- Confirmar que não existem consultas ativas longas varrendo `devedores` por telefone.
- Explicar que o gráfico do Cloud pode levar alguns minutos para refletir a queda, mas a carga real deve reduzir logo após as mudanças.