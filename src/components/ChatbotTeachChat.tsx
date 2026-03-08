import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { GraduationCap, Send, Loader2, Bot, User, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  onRegraCreated: () => void;
}

const INITIAL_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: 'Olá! 👋 Sou sua assistente de treinamento. Me ensine como devo responder seus clientes!\n\nVocê pode me dizer coisas como:\n- *"Quando o cliente perguntar sobre boleto, responda: Vou gerar seu boleto agora!"*\n- *"Se o cliente disser \'quero pagar\', responda com as opções de pagamento"*\n\nO que você quer me ensinar?'
};

export default function ChatbotTeachChat({ onRegraCreated }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasLoaded = useRef(false);

  // Load persisted messages on mount
  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;
    loadHistory();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoadingHistory(false); return; }

      const { data, error } = await supabase
        .from('chat_ia_mensagens')
        .select('role, content')
        .eq('user_id', user.id)
        .eq('image', 'teach-chatbot')
        .order('criado_em', { ascending: true });

      if (!error && data && data.length > 0) {
        setMessages(data.map(d => ({ role: d.role as 'user' | 'assistant', content: d.content })));
      }
    } catch (e) {
      console.error('Erro ao carregar histórico teach:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const persistMessage = async (msg: ChatMessage) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('chat_ia_mensagens').insert({
        user_id: user.id,
        role: msg.role,
        content: msg.content,
        image: 'teach-chatbot',
      });
    } catch (e) {
      console.error('Erro ao salvar mensagem:', e);
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setSending(true);
    await persistMessage(userMsg);

    try {
      const { data, error } = await supabase.functions.invoke('teach-chatbot', {
        body: { messages: updatedMessages }
      });

      if (error) throw error;

      const assistantMsg: ChatMessage = { role: 'assistant', content: data.reply };
      setMessages(prev => [...prev, assistantMsg]);
      await persistMessage(assistantMsg);

      if (data.regra_criada) {
        toast.success('Regra criada com sucesso!');
        onRegraCreated();
      }
    } catch (err) {
      console.error('Erro ao ensinar IA:', err);
      toast.error('Erro ao processar. Tente novamente.');
      const errMsg: ChatMessage = { role: 'assistant', content: 'Desculpe, tive um problema. Pode tentar novamente?' };
      setMessages(prev => [...prev, errMsg]);
      await persistMessage(errMsg);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('chat_ia_mensagens')
          .delete()
          .eq('user_id', user.id)
          .eq('image', 'teach-chatbot');
      }
    } catch (e) {
      console.error('Erro ao limpar histórico:', e);
    }
    setMessages([
      { role: 'assistant', content: 'Conversa reiniciada! 🔄 O que você quer me ensinar agora?' }
    ]);
  };

  return (
    <Card className="flex flex-col h-[500px]">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            Ensinar IA
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={handleClear} className="gap-1 text-xs">
            <Trash2 className="h-3 w-3" />
            Limpar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Converse comigo para me ensinar como responder seus clientes. Eu vou confirmar antes de salvar!
        </p>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col min-h-0 gap-3">
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-1">
          {loadingHistory ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <div
                  className={`rounded-lg px-3 py-2 max-w-[80%] text-sm whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  {msg.content}
                </div>
                {msg.role === 'user' && (
                  <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                    <User className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
            ))
          )}
          {sending && (
            <div className="flex gap-2 justify-start">
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="bg-muted rounded-lg px-3 py-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder='Ex: "Quando o cliente pedir boleto, responda: Vou gerar agora!"'
            rows={2}
            className="text-sm resize-none"
            disabled={sending}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="shrink-0 self-end"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
