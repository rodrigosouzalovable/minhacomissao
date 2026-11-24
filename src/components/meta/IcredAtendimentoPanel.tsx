import { Link } from 'react-router-dom';
import { MessageSquare, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FOLDER_ICRED_INBOX } from '../../../supabase/functions/_shared/icred-atendimento';

const roteiro = [
  ['Apresentação', 'Olá! Sou o IAGO, assistente virtual da Souza e Ribeiro. A antecipação do saque-aniversário FGTS permite contratar crédito usando parte dos seus futuros saques, conforme saldo e análise da instituição. Quer verificar as condições com nossa equipe?'],
  ['Autorização', 'A consulta depende da sua autorização no aplicativo oficial FGTS. Nossa equipe confirma a instituição correta antes desse passo. Não envie senha nem códigos por aqui.'],
  ['Simulação', 'Nossa equipe precisa confirmar o saldo disponível e as condições atuais na iCred. Antes de contratar, você recebe o valor líquido, juros, CET e os saques comprometidos para decidir.'],
  ['Formalização', 'Após seu aceite das condições, nossa equipe encaminha a formalização oficial da sua proposta. Nenhum valor ou prazo de liberação é garantido antes da confirmação da instituição.'],
  ['Encaminhamento', 'Vou encaminhar para nossa equipe continuar sua simulação e tirar suas dúvidas.'],
];

export function IcredAtendimentoPanel() {
  return (
    <section className="flex flex-wrap items-center justify-between gap-4 border-y py-4">
      <div className="space-y-2">
        <h2 className="flex items-center gap-2 font-semibold"><MessageSquare className="h-5 w-5 text-primary" />FGTS iCred</h2>
        <Badge variant="secondary">IAGO preparado · desativado</Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        <Dialog>
          <DialogTrigger asChild><Button variant="outline"><FileText className="mr-2 h-4 w-4" />Roteiro de atendimento</Button></DialogTrigger>
          <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
            <DialogHeader><DialogTitle>Roteiro FGTS iCred</DialogTitle></DialogHeader>
            <div className="space-y-4">
              {roteiro.map(([titulo, texto]) => <div key={titulo} className="space-y-1"><h3 className="font-medium">{titulo}</h3><p className="text-sm text-muted-foreground">{texto}</p></div>)}
            </div>
          </DialogContent>
        </Dialog>
        <Button asChild><Link to={`/admin/inbox-meta?caixa=${FOLDER_ICRED_INBOX}`}><MessageSquare className="mr-2 h-4 w-4" />Abrir caixa</Link></Button>
      </div>
    </section>
  );
}