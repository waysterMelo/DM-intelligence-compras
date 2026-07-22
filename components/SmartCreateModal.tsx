import React, { useEffect, useState } from 'react';
import { ClipboardList, Mail, MessageSquare, Sparkles, X } from 'lucide-react';
import { Department } from '../types';

interface SmartCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (text: string, department: Department) => void;
}

const departments: Department[] = ['Manutenção', 'Produção', 'Ferramentaria', 'Logística', 'Escritório'];

export const SmartCreateModal: React.FC<SmartCreateModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [pastedText, setPastedText] = useState('');
  const [selectedDept, setSelectedDept] = useState<Department>('Manutenção');

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit(pastedText, selectedDept);
    setPastedText('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/55 p-2 backdrop-blur-md sm:items-center sm:p-6">
      <div role="dialog" aria-modal="true" aria-labelledby="smart-create-title" className="flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[1.75rem] border border-white/70 bg-white shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:rounded-[2.25rem]">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-7 sm:py-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-600">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">Nova requisição</p>
              <h2 id="smart-create-title" className="truncate text-xl font-black tracking-tight text-slate-900 sm:text-2xl">Captura inteligente</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar nova requisição" className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-7">
            <div>
              <h3 className="text-sm font-black text-slate-800">Cole a lista de itens</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">Use uma linha por item. Quantidade e descrição serão identificadas automaticamente.</p>
            </div>

            <div className="relative">
              <textarea
                required
                autoFocus
                rows={6}
                aria-label="Lista de itens da nova requisição"
                className="min-h-40 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-base font-semibold leading-relaxed text-slate-800 outline-none transition placeholder:text-slate-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                value={pastedText}
                onChange={event => setPastedText(event.target.value)}
                placeholder={'Exemplo:\n5x Rolamento 6204\n10 pacotes de Luva G\nCimento Votoran 50kg'}
              />
              <div className="pointer-events-none absolute bottom-4 right-4 flex gap-2 text-slate-300">
                <MessageSquare className="h-4 w-4" />
                <Mail className="h-4 w-4" />
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <label className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Setor responsável</label>
                <span className="text-[10px] font-bold text-slate-400">Obrigatório</span>
              </div>
              <div role="group" aria-label="Setor responsável" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {departments.map(department => (
                  <button
                    key={department}
                    type="button"
                    aria-pressed={selectedDept === department}
                    onClick={() => setSelectedDept(department)}
                    className={`min-h-11 rounded-xl border px-3 py-2 text-xs font-black transition ${selectedDept === department ? 'border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-100' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700'}`}
                  >
                    {department}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-100 bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
            <button type="button" onClick={onClose} className="min-h-11 rounded-xl bg-slate-100 px-5 text-sm font-black text-slate-600 transition hover:bg-slate-200">Cancelar</button>
            <button type="submit" disabled={!pastedText.trim()} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-black text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none">
              <Sparkles className="h-4 w-4" />Criar requisições
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};
