---
name: Seleção de campanha separada do controle do pool
description: Checkboxes do Envio Meta só selecionam campanhas; pool é ativado/desativado por botão próprio para admin e parceiro dono
type: feature
---

Na janela Instâncias do Envio Meta, marcar/desmarcar e Selecionar todas/Limpar seleção alteram somente a campanha atual e nunca mudam o pool.

O pool é controlado exclusivamente pelos botões Ativar Pool, Retomar Pool e Desativar Pool. Administradores controlam qualquer instância visível; Parceiros Meta controlam apenas instâncias vinculadas à própria conta, com validação server-side de propriedade.

Uma instância fora do pool pode permanecer selecionada, mas o início da campanha deve ser bloqueado com aviso e a seleção preservada. A reativação após desativação manual exige validação saudável da Meta.
