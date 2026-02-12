
## Plano: Adicionar Botão "Voltar à Página Principal" na Aba de Autenticação

### Contexto
O usuário está na página `/auth` e precisa de uma forma visual e intuitiva de retornar à página principal (`/`), que é o portal público de consulta de débitos do Grupo Altum.

### Solução Proposta

**Objetivo**: Adicionar um elemento de navegação discreto mas acessível que permita ao usuário retornar ao portal público a qualquer momento.

#### 1. Onde Adicionar?
Adicionar um botão na parte superior do Card de autenticação (acima das abas "Entrar" e "Cadastrar"), similar ao padrão já utilizado no fluxo de "Recuperar Senha" que já possui um `ArrowLeft + "Voltar"`.

#### 2. Implementação no `src/pages/Auth.tsx`

**Adições:**
- Importar o ícone `Home` do `lucide-react` (já importado `ArrowLeft`, então não há nova dependência)
- Adicionar um botão acima das abas na seção de login/cadastro
- O botão será um `variant="ghost"` para não competir visualmente com os botões principais de "Entrar" e "Cadastrar"
- Usar `navigate('/')` para retornar à página principal

**Três Opções de Posicionamento:**
1. **Opção A (Recomendada)**: Adicionar um pequeno link/botão no topo do Card, antes do header com o logo
   - Posicionamento: Acima do Card
   - Ícone: `Home` ou `ArrowLeft`
   - Estilo: Botão ghost com texto pequeno

2. **Opção B**: Adicionar dentro do header do Card, alinhado à direita (tipo breadcrumb)
   - Menos intrusivo
   - Alinha com o padrão de "Área Restrita" que já existe no portal

3. **Opção C**: Adicionar no final do Card (após as abas)
   - Menos comum, pero funciona como call-to-action secundária

**Recomendação**: Opção A ou B - manter coerência com o layout existente

#### 3. Conteúdo do Botão
```
Ícone: Home ou ArrowLeft
Texto: "Voltar ao Portal" ou "Voltar à Página Principal"
Ação: navigate('/')
```

#### 4. Aplicar em Todos os Estados
- Login principal
- Cadastro
- Recuperação de Senha

O botão "Voltar ao Login" na tela de recuperação de senha já usa o padrão `ArrowLeft`, portanto seguiremos o mesmo padrão.

### Arquivos a Modificar
- `src/pages/Auth.tsx` - Adicionar botão de navegação

### Benefícios
- Melhora a experiência do usuário (UX)
- Permite transição fácil entre área pública e área restrita
- Padrão coerente com elementos de navegação já existentes

