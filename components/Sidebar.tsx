import React from 'react';
import { 
  Hexagon, Plus, ShoppingBag, List, LayoutGrid, Search, 
  Building2, ChevronRight, User, Settings, LogOut,
  BarChart3, Layers, Zap, Briefcase, Sparkles
} from 'lucide-react';
import { Requisition, Company } from '../types';

interface SidebarProps {
  currentView: 'table' | 'dashboard' | 'quotes' | 'search' | 'companies';
  onViewChange: (view: 'table' | 'dashboard' | 'quotes' | 'search' | 'companies') => void;
  onNewRequest: () => void;
  requisitions: Requisition[];
  currentUser?: { name: string, company: Company } | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, onNewRequest, requisitions, currentUser }) => {
  const pendingCount = requisitions.filter(r => r.status === 'Solicitado' || r.status === 'Cotando').length;

  const NavButton = ({ view, icon: Icon, label, badge }: { view: any, icon: any, label: string, badge?: number }) => {
// ... (rest of NavButton)
    const active = currentView === view;
    return (
      <button 
        onClick={() => onViewChange(view)}
        className={`w-full flex items-center px-6 py-3.5 rounded-2xl text-xs font-black transition-all duration-300 group relative ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
      >
        <Icon className={`w-4 h-4 mr-4 transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`} />
        <span className="uppercase tracking-[0.15em] flex-1 text-left">{label}</span>
        {badge ? (
          <span className={`ml-auto text-[9px] px-2 py-0.5 rounded-full font-black ${active ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'}`}>
            {badge}
          </span>
        ) : null}
        {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full"></div>}
      </button>
    );
  };

  return (
    <aside className="fixed left-6 top-6 bottom-6 w-72 bg-slate-950 rounded-[3rem] flex flex-col shadow-2xl z-50 overflow-hidden border border-white/5 hidden lg:flex">
      
      <div className="h-28 flex items-center px-10 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-600/10 to-transparent"></div>
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-12 h-12 rounded-[1.2rem] bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-xl shadow-blue-900/40 border border-white/10">
            <Zap className="w-6 h-6 text-white fill-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tighter leading-none">DM Intelligence | Compras</h1>
            <p className="text-[9px] text-blue-400 font-black uppercase tracking-[0.3em] mt-1.5">PRO PROCUREMENT</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-2">
        <button 
          onClick={onNewRequest}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/50 rounded-2xl py-5 px-6 flex items-center justify-center gap-3 transition-all hover:scale-[1.03] active:scale-95 group relative overflow-hidden border border-white/10"
        >
          <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
          <div className="p-1 bg-white/20 rounded-lg">
             <Plus className="w-4 h-4 stroke-[4]" />
          </div>
          <span className="font-black uppercase text-[10px] tracking-widest relative z-10">Nova Requisição</span>
        </button>
      </div>

      <nav className="flex-1 px-4 space-y-8 mt-10 overflow-y-auto no-scrollbar">
        
        {/* GRUPO: GESTÃO DE COMPRAS */}
        <div>
          <div className="px-6 mb-4 flex items-center gap-3">
             <div className="h-px flex-1 bg-white/5"></div>
             <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em]">Gestão de Compras</p>
             <div className="h-px flex-1 bg-white/5"></div>
          </div>
          <div className="space-y-1.5">
            <NavButton view="quotes" icon={ShoppingBag} label="QG Estratégico" badge={pendingCount} />
            <NavButton view="table" icon={List} label="Histórico Geral" />
            <NavButton view="search" icon={Search} label="Busca Inteligente" />
          </div>
        </div>

        {/* GRUPO: ESTRATÉGIA & BI */}
        <div>
          <div className="px-6 mb-4 flex items-center gap-3">
             <div className="h-px flex-1 bg-white/5"></div>
             <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em]">Estratégia & BI</p>
             <div className="h-px flex-1 bg-white/5"></div>
          </div>
          <div className="space-y-1.5">
            <NavButton view="dashboard" icon={BarChart3} label="Dashboard de Saving" />
          </div>
        </div>

        {/* GRUPO: EMPRESAS */}
        <div>
          <div className="px-6 mb-4 flex items-center gap-3">
             <div className="h-px flex-1 bg-white/5"></div>
             <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em]">Empresas</p>
             <div className="h-px flex-1 bg-white/5"></div>
          </div>
          <div className="space-y-1.5">
            <NavButton view="companies" icon={Building2} label="Parceiros Fiscais" />
          </div>
        </div>
      </nav>

      <div className="p-6 mt-auto">
        <div className="bg-white/5 rounded-[2rem] p-5 flex items-center gap-4 border border-white/5 backdrop-blur-md group hover:bg-white/10 transition-all cursor-pointer">
          <div className="relative">
            <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 p-0.5">
               <div className="w-full h-full rounded-full border-2 border-slate-900 flex items-center justify-center text-white font-black text-xs uppercase">
                 {currentUser?.name ? currentUser.name.substring(0, 2) : 'US'}
               </div>
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-900 rounded-full"></div>
          </div>
          <div className="overflow-hidden flex-1">
            <p className="text-xs font-black text-white truncate uppercase">{currentUser?.name || 'Usuário'}</p>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5 truncate">{currentUser?.company?.name || 'Comprador'}</p>
          </div>
          <Settings className="w-4 h-4 text-slate-600 group-hover:text-blue-400 transition-colors" />
        </div>
      </div>
    </aside>
  );
};
