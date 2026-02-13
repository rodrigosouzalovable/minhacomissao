
## Plano: Criar páginas de Política de Privacidade e Antifraude

### Resumo
Criar duas novas páginas completas com conteúdo jurídico e atualizar os links no footer do portal para direcionar corretamente.

### Páginas a criar

**1. `/politica-de-privacidade` - Política de Privacidade**
Página com o conteúdo completo fornecido, adaptado para "SOUZA E RIBEIRO SOCIEDADE DE ADVOGADOS" (substituindo todas as referências a "Viventi" pelo nome correto da empresa). Incluirá:
- Tipos de dados pessoais tratados (identificação, navegação, financeiros, cookies etc.)
- Como os dados são obtidos
- Finalidades do tratamento
- Bases legais
- Comunicação e canais
- Compartilhamento de dados com terceiros
- Direitos do titular (seção complementar adicionada)
- Contato do encarregado/DPO (seção complementar)

**2. `/antifraude` - Antifraude**
Página com o conteúdo fornecido sobre empréstimos e boletos, complementada com:
- Alerta sobre golpes comuns (phishing, links falsos)
- Orientações de como verificar a autenticidade de contatos
- Canais oficiais de atendimento
- Dicas de segurança para o usuário

### Estilo visual
Ambas as páginas seguirão o mesmo padrão visual do portal (cores, header com logos, footer), mantendo a identidade visual consistente.

### Alterações em arquivos existentes

**3. `src/pages/PortalConsulta.tsx`** (linhas 266-267)
Atualizar os links do footer de `href="#"` para as rotas corretas:
- Política de Privacidade: `/politica-de-privacidade`
- Antifraude: `/antifraude`

**4. `src/App.tsx`**
Adicionar as duas novas rotas públicas:
- `/politica-de-privacidade` → PoliticaPrivacidade
- `/antifraude` → Antifraude

### Detalhes técnicos

- Criar `src/pages/PoliticaPrivacidade.tsx` com layout completo (header, conteúdo, footer)
- Criar `src/pages/Antifraude.tsx` com layout completo (header, conteúdo, footer)
- Reutilizar as mesmas logos e constantes (PHONE, PHONE_DISPLAY) do PortalConsulta
- Todas as menções a "Viventi" serão substituídas por "Souza e Ribeiro Sociedade de Advogados"
- Ambas as páginas terão botão de voltar para a página inicial
- WhatsApp floating button incluído em ambas
