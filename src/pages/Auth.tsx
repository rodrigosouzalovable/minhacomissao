import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

const signupSchema = loginSchema.extend({
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(100, 'Nome muito longo'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Senhas não conferem',
  path: ['confirmPassword'],
});

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [signupData, setSignupData] = useState({ nome: '', email: '', password: '', confirmPassword: '' });
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validated = loginSchema.parse(loginData);
      const { error } = await signIn(validated.email, validated.password);
      
      if (error) {
        toast({
          variant: 'destructive',
          title: 'Erro ao entrar',
          description: error.message === 'Invalid login credentials' 
            ? 'E-mail ou senha incorretos'
            : error.message,
        });
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({
          variant: 'destructive',
          title: 'Dados inválidos',
          description: err.errors[0].message,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validated = signupSchema.parse(signupData);
      const { error } = await signUp(validated.email, validated.password, validated.nome);
      
      if (error) {
        const errorMessage = error.message.includes('already registered')
          ? 'Este e-mail já está cadastrado'
          : error.message;
        
        toast({
          variant: 'destructive',
          title: 'Erro ao cadastrar',
          description: errorMessage,
        });
      } else {
        toast({
          title: 'Cadastro realizado!',
          description: 'Você já pode fazer login.',
        });
        navigate('/dashboard');
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({
          variant: 'destructive',
          title: 'Dados inválidos',
          description: err.errors[0].message,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">MINHA COMISSÃO</CardTitle>
          <CardDescription>Sistema de gestão de comissões</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">E-mail</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={loginData.email}
                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••"
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Entrando...' : 'Entrar'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-nome">Nome completo</Label>
                  <Input
                    id="signup-nome"
                    type="text"
                    placeholder="Seu nome"
                    value={signupData.nome}
                    onChange={(e) => setSignupData({ ...signupData, nome: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">E-mail</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={signupData.email}
                    onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Senha</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={signupData.password}
                    onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm">Confirmar senha</Label>
                  <Input
                    id="signup-confirm"
                    type="password"
                    placeholder="Confirme sua senha"
                    value={signupData.confirmPassword}
                    onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Cadastrando...' : 'Cadastrar'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
