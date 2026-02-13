
## Plano: Aumentar a logo da Souza e Ribeiro no header

### Alteração
**Arquivo**: `src/pages/PortalConsulta.tsx` (linha 66)

Aumentar o tamanho da logo de Souza e Ribeiro no header de `h-12 sm:h-16` para `h-14 sm:h-20`

### Novo tamanho:
- **Mobile**: `h-14` = **56px**
- **Desktop**: `h-sm:h-20` = **80px**

### Alteração específica:

```tsx
// De:
<img src={logoSouzaRibeiro} alt="Souza e Ribeiro" className="h-12 sm:h-16 w-auto" style={{ filter: 'brightness(0) invert(1)' }} />

// Para:
<img src={logoSouzaRibeiro} alt="Souza e Ribeiro" className="h-14 sm:h-20 w-auto" style={{ filter: 'brightness(0) invert(1)' }} />
```

### Resultado
- Aumento de 8px no mobile (de 48px para 56px)
- Aumento de 16px no desktop (de 64px para 80px)
- Logo mais proeminente no header, mantendo proporção com outros elementos
