

## Plano: Exibir foto atual do perfil WhatsApp

### Problema
A foto do perfil não aparece porque estamos tentando buscar via endpoints que são para **alterar** a foto, não para **obter** a foto atual. O endpoint `/profile/image` (POST) é para definir uma nova imagem, e o `/business/get/profile` pode não retornar a URL da foto.

### Solução

**Arquivo: `src/pages/Acionamento.tsx`**

**1. Adicionar logging para depurar a resposta da API**
- Adicionar `console.log` temporário nas respostas de `/business/get/profile` e `/profile/image` para ver exatamente o que a UAZAPI retorna — isso nos dirá se a foto está vindo em algum campo que não estamos lendo.

**2. Usar o endpoint correto para buscar a foto**
A UAZAPI provavelmente disponibiliza a foto do perfil via um endpoint de contatos ou instância. Vamos tentar:
- `GET {server_url}/instance/info` ou `POST {server_url}/instance/info` — muitas APIs retornam dados completos da instância incluindo a foto
- `POST {server_url}/contacts/getProfilePicture` com o próprio JID da instância — endpoint comum para obter foto de qualquer número
- Manter o fallback para campos da resposta do `/business/get/profile`

**3. Atualizar `loadWhatsAppProfile`**
- Tentar buscar a foto via múltiplos endpoints em cascata:
  1. Extrair do retorno de `/business/get/profile` (campos: `profilePictureUrl`, `imgUrl`, `picture`, `profilePicUrl`, `photo`)
  2. Tentar `POST /contacts/getProfilePicture` passando o JID próprio
  3. Tentar `GET /instance/info` para dados completos
- Logar a resposta completa de cada endpoint para debug

### Detalhes técnicos

- O principal problema é que não sabemos com certeza o formato exato da resposta. Vou adicionar logs e testar múltiplos endpoints em cascata.
- A abordagem será resiliente: tentar vários endpoints e usar o primeiro que retornar uma URL válida.
- A foto será exibida no avatar circular já existente na UI.

### Arquivo afetado

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Acionamento.tsx` | Melhorar `loadWhatsAppProfile` com endpoints adicionais e logs de debug |

