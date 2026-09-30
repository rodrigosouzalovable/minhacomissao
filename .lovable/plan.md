# Medição exata da recuperação de qualidade Meta

## Resultado
- Registrar automaticamente cada ciclo em que um número cai para YELLOW/RED.
- Marcar quando o aquecimento é ativado e quando ocorre o primeiro envio aceito para UAZAPI.
- Encerrar o ciclo no primeiro retorno confirmado a GREEN.
- Calcular o tempo exato da queda até GREEN e do primeiro envio UAZAPI até GREEN.
- Mostrar no painel a média, mediana, quantidade recuperada e o andamento dos números atuais.

## Regras preservadas
- Não criar novo cron, polling ou consulta externa à Meta.
- Reutilizar as verificações de saúde e os envios UAZAPI que já existem.
- Não enviar mensagens de teste.
- Manter bloqueios Meta, limites diários, intervalos e destinatários UAZAPI atuais.

## Detalhes técnicos
- Criar uma tabela leve e indexada de ciclos de recuperação, protegida por acesso do proprietário e administradores.
- Usar eventos internos do banco para capturar mudanças de qualidade, ativação da recuperação e primeiro envio aceito, mesmo que ocorram por caminhos diferentes.
- Preencher os ciclos atualmente ativos usando os horários já registrados; dados antigos incompletos serão identificados como históricos parciais, sem inventar precisão.
- Atualizar o painel de recuperação para consumir o resumo calculado e exibir durações reais.
- Validar permissões, cálculos, tela e compilação sem disparar mensagens.
