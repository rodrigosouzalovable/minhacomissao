

## Plano: Exibir foto atual do perfil e permitir upload de arquivo

### Problema
1. A foto atual do perfil WhatsApp não é exibida no formulário de edição
2. Só é possível alterar a foto via URL — o usuário quer poder fazer upload de arquivo local

### Solução

**Arquivo: `src/pages/Acionamento.tsx`**

**1. Exibir foto atual do perfil**
- Adicionar estado `currentProfilePhotoUrl` para armazenar a URL da foto atual
- No `loadWhatsAppProfile`, buscar a foto atual via `GET {server_url}/profile/image` ou extrair do retorno de `/business/get/profile` (campo `profilePictureUrl` ou similar)
- Exibir um avatar/thumbnail acima do input de foto mostrando a imagem atual (ou um placeholder se não houver)

**2. Upload de arquivo local (converter para base64)**
- Substituir o input de URL por um input `type="file"` (accept="image/*") com um botão "Enviar"
- Ao selecionar o arquivo, converter para base64 usando `FileReader`
- Enviar para `POST /profile/image` com body `{ "base64": "data:image/jpeg;base64,..." }` (a UAZAPI aceita base64)
- Exibir preview da imagem selecionada antes do envio
- Manter o botão "Remover" para remover a foto

**3. Layout da seção de foto**
- Foto atual (circular, ~64px) à esquerda
- À direita: botão "Escolher imagem" + botão "Remover"
- Abaixo: preview da imagem selecionada (se houver) + botão "Aplicar"

### Detalhes técnicos

- A UAZAPI aceita base64 no endpoint `/profile/image` — o body pode ser `{ "url": "data:image/jpeg;base64,..." }` ou `{ "base64": "..." }`
- O `loadWhatsAppProfile` será expandido para também buscar `profilePictureUrl` do retorno da API
- Usar `FileReader.readAsDataURL()` para converter o arquivo para base64
- Remover o campo `profilePhotoUrl` de texto e substituir por `profilePhotoFile` (File | null) e `profilePhotoPreview` (string base64)

