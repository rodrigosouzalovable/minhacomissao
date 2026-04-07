

# Inserir Configurações Anti-Ban no Banco de Dados

## Contexto

A tabela `whatsapp_aquecimento_config` precisa de 2 novas chaves (`pausa_almoco`, `reducao_fim_semana`) para que o painel funcione corretamente. Além disso, a chave `limites_por_fase` existente tem valores antigos (`{fase1:10, fase2:15, fase3:25, fase4:30, aquecido:30}`) que precisam ser atualizados para `{fase1:1, fase2:3, fase3:7, fase4:15, aquecido:25}`.

## Ações

### 1. Inserir `pausa_almoco`
- Chave: `pausa_almoco`
- Valor: `true`
- Descrição: "Ativar pausa de almoço entre 12h e 14h"

### 2. Inserir `reducao_fim_semana`
- Chave: `reducao_fim_semana`
- Valor: `{"sabado": 60, "domingo": 40}`
- Descrição: "Percentual do limite em sábados e domingos"

### 3. Atualizar `limites_por_fase`
- De: `{fase1:10, fase2:15, fase3:25, fase4:30, aquecido:30}`
- Para: `{fase1:1, fase2:3, fase3:7, fase4:15, aquecido:25}`

Essas operações serão feitas via SQL INSERT/UPDATE diretamente no banco. Nenhuma mudança de código é necessária.

