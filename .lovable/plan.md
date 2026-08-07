# Separar o IAGO do login do Thiago Nogueira

## O que está acontecendo

Confirmado no banco: **não existe** usuário IAGO — o único perfil com "iago" no nome é **Thiago Nogueira**. A tela de Usuários identifica o IAGO por qualquer nome que contenha "iago", e "Th-iago" cai nessa regra. Por isso o botão "Configurar IAGO" e o selo "IA" apareceram na linha do Thiago. A configuração do IAGO (`iago_config`) está sem usuário vinculado (`user_id` vazio), então nada foi gravado no login do Thiago — só a tela estava errada.

## Correções

1. **Identificação correta do IAGO**
   - Passa a ser pelo usuário vinculado na configuração (`iago_config.user_id`), com fallback para nome que comece por "IAGO " (nunca "Thiago").
   - Resultado: selo "IA" e botão "Configurar IAGO" saem da linha do Thiago Nogueira.

2. **Criar o usuário IAGO RIBEIRO DE SOUZA**
   - Criado como usuário real do sistema: nome `IAGO RIBEIRO DE SOUZA`, e-mail `iago@meusacordos.com.br`, senha gerada, perfil ativo.
   - Ao criar, o sistema vincula automaticamente esse usuário à configuração do IAGO (`iago_config.user_id`), à etiqueta `Atendente: IAGO...` e à fila de atendimento.
   - O botão "Preencher dados do IAGO (IA)" continua na tela, mas só aparece enquanto o IAGO não existir de verdade.

3. **Configuração só na linha do IAGO**
   - "Configurar IAGO" (abas Personalidade / Ensinar / Perguntas / Nunca fazer / Aprendizado / Follow-up / Testar) aparece exclusivamente na linha do IAGO RIBEIRO DE SOUZA, visível apenas para admin.

## Detalhes técnicos

- `src/pages/AdminUsuarios.tsx`: trocar `ehIago = /iago/i.test(nome)` por checagem contra `iago_config.user_id` (carregado via query) com fallback `^\s*iago\b`; ajustar `iagoExiste` e a exibição do selo/botão.
- `src/components/inbox/meta/MetaFolderAcessoDialog.tsx`: mesma regra do selo "IA" (hoje também usaria o Thiago).
- Ao criar o usuário do IAGO: `UPDATE iago_config SET user_id = <novo id>` e chamada de `meta_provisionar_atendentes_fila` quando ele for marcado numa caixa.
