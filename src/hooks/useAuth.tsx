import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, nome: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const accessNotificationUserRef = useRef<string | null>(null);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !session?.access_token) {
      accessNotificationUserRef.current = null;
      return;
    }
    if (accessNotificationUserRef.current === user.id) return;
    accessNotificationUserRef.current = user.id;

    const accessId = crypto.randomUUID();
    let cancelled = false;
    const registerAccess = async () => {
      for (let attempt = 1; attempt <= 3 && !cancelled; attempt += 1) {
        const { data, error } = await supabase.functions.invoke('notificar-acesso-usuario', {
          body: { accessId },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!error && (data?.ok || data?.skipped)) return;
        console.error(`Falha ao registrar acesso do usuário (tentativa ${attempt}):`, error?.message || data?.error);
        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
      }
      if (!cancelled) accessNotificationUserRef.current = null;
    };
    void registerAccess();
    return () => { cancelled = true; };
  }, [user, session?.access_token]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error as Error | null };

    // Check if user is active
    const userId = data.user?.id;
    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profile && (profile as any).ativo === false) {
        await supabase.auth.signOut();
        return { error: new Error('Sua conta está inativa. Entre em contato com o administrador.') };
      }
    }

    return { error: null };
  };

  const signUp = async (email: string, password: string, nome: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { nome }
      }
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = `${window.location.origin}/auth`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    return { error: error as Error | null };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
