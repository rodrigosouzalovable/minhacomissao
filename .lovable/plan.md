
## Plano: Aumentar tamanho das logomarcas na página inicial (PortalConsulta)

### Resumo
Aumentar o tamanho das duas logomarcas (Souza e Ribeiro + Grupo Altum) em três seções da página inicial para melhor visibilidade e impacto visual.

### Locais de Alteração

**1. Header (linhas 66-68)**
- Aumentar de `h-10 sm:h-12` para `h-12 sm:h-16`
- Maior presença no topo da página

**2. Seção "Quem Somos" (linhas 176-178)**
- Aumentar de `h-12 sm:h-16` para `h-16 sm:h-20`
- Maior destaque das logos junto com a descrição da empresa

**3. Footer (linhas 256-258)**
- Aumentar de `h-10 sm:h-12` para `h-12 sm:h-14`
- Melhor proporção no rodapé

### Alterações Específicas

**Header (linhas 66-68):**
```tsx
// De:
<img src={logoSouzaRibeiro} alt="Souza e Ribeiro" className="h-10 sm:h-12 w-auto" style={{ filter: 'brightness(0) invert(1)' }} />
...
<img src={logoGrupoAltum} alt="Grupo Altum" className="h-10 sm:h-12 w-auto" />

// Para:
<img src={logoSouzaRibeiro} alt="Souza e Ribeiro" className="h-12 sm:h-16 w-auto" style={{ filter: 'brightness(0) invert(1)' }} />
...
<img src={logoGrupoAltum} alt="Grupo Altum" className="h-12 sm:h-16 w-auto" />
```

**Seção Quem Somos (linhas 176-178):**
```tsx
// De:
<img src={logoSouzaRibeiro} alt="Souza e Ribeiro Advogados" className="h-12 sm:h-16 w-auto" />
...
<img src={logoGrupoAltum} alt="Grupo Altum" className="h-12 sm:h-16 w-auto" style={{ filter: 'brightness(0)' }} />

// Para:
<img src={logoSouzaRibeiro} alt="Souza e Ribeiro Advogados" className="h-16 sm:h-20 w-auto" />
...
<img src={logoGrupoAltum} alt="Grupo Altum" className="h-16 sm:h-20 w-auto" style={{ filter: 'brightness(0)' }} />
```

**Footer (linhas 256-258):**
```tsx
// De:
<img src={logoSouzaRibeiro} alt="Souza e Ribeiro" className="h-10 sm:h-12 w-auto" style={{ filter: 'brightness(0) invert(1)' }} />
...
<img src={logoGrupoAltum} alt="Grupo Altum" className="h-10 sm:h-12 w-auto" />

// Para:
<img src={logoSouzaRibeiro} alt="Souza e Ribeiro" className="h-12 sm:h-14 w-auto" style={{ filter: 'brightness(0) invert(1)' }} />
...
<img src={logoGrupoAltum} alt="Grupo Altum" className="h-12 sm:h-14 w-auto" />
```

### Resultado Esperado
- Logomarcas mais visíveis e com maior presença visual na página
- Melhor proporção em relação aos demais elementos
- Maior impacto na identidade visual do portal (especialmente no header e seção "Quem Somos")
- Responsive correto em dispositivos móveis (sm) e desktop
