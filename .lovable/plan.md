
## Plano: Adicionar logo do Grupo Altum no header da pagina de negociacao

### Resumo
Substituir o placeholder "GA" (quadrado verde com texto) pela logo real do Grupo Altum no header da pagina `ConsultaResultado.tsx`.

### Alteracoes

**1. Copiar a logo para o projeto**
- Copiar o arquivo `Gemini_Generated_Image_dcmat4dcmat4dcma-removebg-preview_1-2.png` para `src/assets/logo-grupo-altum-negociacao.png`

**2. Modificar `src/pages/ConsultaResultado.tsx`**
- Importar a imagem da logo no topo do arquivo
- Substituir o `<div>` com "GA" por um `<img>` com a logo real
- Ajustar o tamanho da imagem para caber no header (aproximadamente 40x40px ou auto-height)

### Detalhe tecnico

**Trecho atual (header):**
```tsx
<div className="h-10 w-10 rounded-lg flex items-center justify-center font-bold text-lg" style={{ background: '#00a86b', color: '#fff' }}>GA</div>
```

**Substituir por:**
```tsx
<img src={logoGrupoAltum} alt="Grupo Altum" className="h-10" />
```

Com o import no topo:
```tsx
import logoGrupoAltum from '@/assets/logo-grupo-altum-negociacao.png';
```
