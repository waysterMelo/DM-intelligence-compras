import React, { useState } from 'react';
import { BarChart3, Building2, Gauge, List, Menu, Plus, Search, Settings, ShoppingBag, X, Zap } from 'lucide-react';
import { Company, Requisition } from '../types';

type View = 'table' | 'dashboard' | 'quotes' | 'quick' | 'search' | 'companies';

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  onNewRequest: () => void;
  requisitions: Requisition[];
  currentUser?: { name: string; company: Company } | null;
}

const items = [
  { view: 'quotes' as const, icon: ShoppingBag, label: 'QG Estratégico' },
  { view: 'quick' as const, icon: Gauge, label: 'Compras Rápidas' },
  { view: 'table' as const, icon: List, label: 'Histórico Geral' },
  { view: 'search' as const, icon: Search, label: 'Busca Inteligente' },
  { view: 'dashboard' as const, icon: BarChart3, label: 'Dashboard de Saving' },
  { view: 'companies' as const, icon: Building2, label: 'Fornecedores & TCO' },
];

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, onNewRequest, requisitions, currentUser }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pendingCount = requisitions.filter(item => ['Solicitado', 'Cotando'].includes(item.status)).length;
  const invoicePendingCount = requisitions.filter(item => item.costReconciliationStatus === 'PENDING_INVOICE').length;
  const badgeFor = (view: View) => view === 'quotes' ? pendingCount : view === 'quick' ? invoicePendingCount : 0;

  const changeView = (view: View) => {
    onViewChange(view);
    setMobileMenuOpen(false);
  };

  return (
    <>
      <aside className="fixed bottom-6 left-6 top-6 z-50 hidden w-72 flex-col overflow-hidden rounded-[3rem] border border-white/5 bg-slate-950 shadow-2xl lg:flex">
        <div className="flex h-24 items-center gap-3 px-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-lg shadow-blue-950/40"><Zap className="h-5 w-5 fill-white text-white" /></div>
          <div><h1 className="text-lg font-black leading-none text-white">DM Intelligence</h1><p className="mt-1 text-[9px] font-black uppercase tracking-[0.24em] text-blue-400">Compras</p></div>
        </div>

        <div className="px-5 pb-5">
          <button onClick={onNewRequest} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-950/40 transition hover:-translate-y-0.5">
            <Plus className="h-4 w-4" />Nova requisição
          </button>
        </div>

        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 pb-4 no-scrollbar" aria-label="Navegação principal">
          {items.map(({ view, label, icon: Icon }) => {
            const active = currentView === view;
            const badge = badgeFor(view);
            return (
              <button key={view} onClick={() => changeView(view)} className={`relative flex w-full items-center rounded-2xl px-5 py-3 text-xs font-black transition ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                <Icon className="mr-4 h-4 w-4" />
                <span className="flex-1 text-left uppercase tracking-[0.12em]">{label}</span>
                {badge > 0 && <span className={`rounded-full px-2 py-0.5 text-[9px] ${active ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'}`}>{badge}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-5">
          <div className="flex items-center gap-3 rounded-[1.5rem] border border-white/5 bg-white/5 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 text-xs font-black uppercase text-white">{currentUser?.name?.substring(0, 2) || 'US'}</div>
            <div className="min-w-0 flex-1"><p className="truncate text-xs font-black uppercase text-white">{currentUser?.name || 'Usuário'}</p><p className="mt-0.5 truncate text-[9px] font-bold uppercase tracking-wider text-slate-500">{currentUser?.company?.name || 'Comprador'}</p></div>
            <Settings className="h-4 w-4 text-slate-600" />
          </div>
        </div>
      </aside>

      <div className="fixed inset-x-3 bottom-3 z-[80] lg:hidden">
        {mobileMenuOpen && (
          <div className="mb-3 rounded-[2rem] border border-slate-200 bg-white p-3 shadow-2xl">
            <div className="flex items-center justify-between px-2 pb-2"><div><p className="text-sm font-black text-slate-900">Menu de Compras</p><p className="text-xs text-slate-400">{currentUser?.company?.name}</p></div><button onClick={() => setMobileMenuOpen(false)} className="rounded-xl p-2 text-slate-500" aria-label="Fechar menu"><X className="h-5 w-5" /></button></div>
            <div className="grid grid-cols-2 gap-2">{items.map(({ view, icon: Icon, label }) => <button key={view} onClick={() => changeView(view)} className={`flex items-center gap-2 rounded-xl p-3 text-left text-xs font-bold ${currentView === view ? 'bg-blue-50 text-blue-700' : 'bg-slate-50 text-slate-600'}`}><Icon className="h-4 w-4" />{label}{badgeFor(view) > 0 && <span className="ml-auto rounded-full bg-blue-600 px-1.5 py-0.5 text-[9px] text-white">{badgeFor(view)}</span>}</button>)}</div>
          </div>
        )}
        <nav className="grid grid-cols-5 items-center rounded-[1.7rem] border border-white/10 bg-slate-950 px-2 py-2 text-white shadow-2xl" aria-label="Navegação móvel">
          <button onClick={() => changeView('quotes')} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[9px] font-bold ${currentView === 'quotes' ? 'bg-blue-600' : 'text-slate-400'}`}><ShoppingBag className="h-4 w-4" />Cotações</button>
          <button onClick={() => changeView('quick')} className={`relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[9px] font-bold ${currentView === 'quick' ? 'bg-blue-600' : 'text-slate-400'}`}><Gauge className="h-4 w-4" />Rápidas{invoicePendingCount > 0 && <span className="absolute right-2 top-1 h-4 min-w-4 rounded-full bg-amber-400 px-1 text-[9px] leading-4 text-slate-950">{invoicePendingCount}</span>}</button>
          <button onClick={onNewRequest} className="mx-auto flex h-12 w-12 -translate-y-3 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-lg shadow-blue-900/40" aria-label="Nova requisição"><Plus className="h-5 w-5" /></button>
          <button onClick={() => changeView('dashboard')} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[9px] font-bold ${currentView === 'dashboard' ? 'bg-blue-600' : 'text-slate-400'}`}><BarChart3 className="h-4 w-4" />Indicadores</button>
          <button onClick={() => setMobileMenuOpen(open => !open)} className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[9px] font-bold text-slate-400" aria-expanded={mobileMenuOpen}><Menu className="h-4 w-4" />Menu</button>
        </nav>
      </div>
    </>
  );
};
