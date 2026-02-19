

## Adicionar botao de mostrar/ocultar senha na pagina de login

### Alteracao

**Arquivo:** `src/pages/Auth.tsx`

Adicionar um icone de olho (Eye/EyeOff do lucide-react) dentro do campo de senha para alternar entre `type="password"` e `type="text"`.

### Detalhes tecnicos

1. Adicionar estado `showPassword` (boolean, inicialmente `false`)
2. Envolver o input de senha em um `div` com `relative`
3. Adicionar botao com icone `Eye` ou `EyeOff` posicionado absolutamente a direita do input
4. Alternar o `type` do input entre `"password"` e `"text"` conforme o estado

Trecho resultante:

```tsx
const [showPassword, setShowPassword] = useState(false);

// No JSX:
<div className="relative">
  <Input
    id="login-password"
    type={showPassword ? "text" : "password"}
    ...
  />
  <button
    type="button"
    onClick={() => setShowPassword(!showPassword)}
    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
  >
    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
  </button>
</div>
```

Imports adicionais: `Eye, EyeOff` do `lucide-react`.

