

# Plano: QR Code para conectar WhatsApp no Acionamento

## Contexto
No projeto ZAP BOOOT, ao adicionar um WhatsApp, o sistema usa a **API administrativa do UAZAPI** para:
1. Criar uma instância automaticamente (`/instance/init`)
2. Gerar um QR Code (`/instance/connect`)
3. Monitorar o status via polling (`/instance/status`)
4. Configurar webhook automaticamente (`/webhook/{token}`)

## O que você precisa configurar

Para que o QR Code funcione aqui, você precisa de **2 secrets** no seu backend:

| Secret | Descrição | Onde encontrar |
|--------|-----------|----------------|
| `UAZAPI_BASE_URL` | URL base do painel admin UAZAPI (ex: `https://certificadoracnpj.uazapi.com`) | Painel UAZAPI |
| `UAZAPI_ADMIN_TOKEN` | Token administrativo do UAZAPI (diferente do token de instância) | Painel UAZAPI → Configurações → Admin Token |

O **Admin Token** é o token que permite **criar novas instâncias** e gerenciar todas elas. Sem ele, só é possível usar instâncias já existentes (como funciona hoje com server_url + instance_token manual).

## Mudanças necessárias

### 1. Nova Edge Function `whatsapp-qr`
Baseada na do ZAP BOOOT, adaptada para este projeto:
- `create-instance`: Cria instância UAZAPI e salva na tabela `user_whatsapp_instances`
- `qr`: Busca QR Code da instância
- `status`: Verifica se conectou
- `setup-webhook`: Configura webhook do chatbot automaticamente
- `disconnect`: Desconecta e remove instância

### 2. Alterar UI do Acionamento
No dialog de "Adicionar" instância:
- Em vez de pedir server_url e instance_token manualmente, mostrar um botão "Conectar WhatsApp"
- Ao clicar, criar instância via API admin e exibir QR Code
- Polling a cada 3s para detectar conexão
- Countdown de 60s com opção de atualizar QR
- Manter opção manual como fallback (para quem já tem instância configurada)

### 3. Adicionar config.toml
```toml
[functions.whatsapp-qr]
verify_jwt = false
```

## Pergunta antes de prosseguir

Você tem acesso ao **Admin Token** do UAZAPI? Ele é diferente do token de instância individual. Normalmente fica nas configurações gerais do painel UAZAPI. Sem ele, não é possível criar instâncias automaticamente nem gerar QR Codes.

