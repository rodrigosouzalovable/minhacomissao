# Aba UAZAPI: página de números de WhatsApp

## Objetivo

A aba "Acionamento" passa a se chamar **UAZAPI** e mostra apenas a tela de configuração dos números conectados na UAZAPI. Toda a área de acionamento (upload de planilha, pendentes, enviados, IA/conversas) sai.

## O que muda

1. **Renomear a aba**: menu lateral passa de "Acionamento" para "UAZAPI".
2. **Página principal = configuração de WhatsApp**: o conteúdo que hoje abre no diálogo "Configurações WhatsApp" (lista de instâncias, conectar via QR/código, editar, ativar/desativar, robô/IA, webhook, atualização de nomes em lote) fica direto na página, sem diálogo.
3. **Remover do formulário de cada instância**: o bloco "Perfil WhatsApp" (foto, nome, descrição, endereço, e-mail, atualização em massa de perfil) e o bloco "Proxy SOCKS5 / HTTP".
4. **Novo campo "Número do WhatsApp"** logo abaixo do campo Nome, salvo na instância. Aceita digitação livre e é normalizado ao salvar (apenas dígitos, com DDI 55 quando faltar). O número aparece no card de cada instância.
5. **Botão "Exportar números (Excel)"** no topo da lista de instâncias: gera um arquivo .xlsx com uma única coluna A contendo os números cadastrados, sem cabeçalho, um por linha.
6. **Remover a área de acionamento**: seções de planilha/pendentes/enviados/IA e o histórico de planilhas saem da página.

## Detalhes técnicos

- `src/pages/Acionamento.tsx` é reescrito de forma enxuta: mantém somente estados e funções de instâncias (fetch, salvar, QR/código, reconectar, status de conexão, webhook, ativar/desativar, ordenação drag-and-drop, alteração de nome em lote) e remove o resto (parse de planilha, envio, auto-send, conversas IA, config de relatório).
- Rota `/admin/acionamento` mantida (evita quebrar permissões existentes em `user_permissions` e links salvos); apenas o rótulo no `AppLayout` muda para "UAZAPI". O indicador de progresso de auto-envio ligado a essa rota no `AppLayout` é removido.
- Campo número usa a coluna existente `user_whatsapp_instances.telefone` — nenhuma migração de banco necessária.
- Exportação usa `xlsx` já presente no projeto, escrevendo `aoa_to_sheet` com uma coluna.
- `src/components/acionamento/ProxyInstanceSection.tsx` deixa de ser usado e é removido do import (arquivo pode ser apagado).
- Nenhuma alteração em edge functions, envio de mensagens ou espelhamento no Inbox Meta.

## Observação

O contexto de auto-envio (`WhatsAppSendingContext`) continua existindo para os outros fluxos; apenas esta página para de usá-lo.
