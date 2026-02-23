import React from 'react';
import { Requisition, Status } from '../types';
import { StatusBadge, PriorityBadge } from './StatusBadge';
import { ArrowRight, Calculator, Clock, AlertCircle } from 'lucide-react';

interface PurchasingPanelProps {
  requisitions: Requisition[];
  onOpenTco: (id: string) => void;
}

export const PurchasingPanel: React.FC<PurchasingPanelProps> = ({ requisitions, onOpenTco }) => {
  // Filtramos apenas o que não foi concluído (Solicitado ou Cotando)
  const pendingItems = requisitions.filter(r => r.status === 'Solicitado' || r.status === 'Cotando');

  if (pendingItems.length === 0) {
    return (
      <div className="bg-white p-12 rounded-[2.5rem] shadow-soft border border-slate-50 text-center">
        <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-800">Tudo em dia!</h3>
        <p className="text-slate-500 mt-2">Não há requisições pendentes de cotação no momento.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4 px-2">
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-600" /> Fila de Suprimentos
        </h2>
        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-black">
          {pendingItems.length} ITENS PENDENTES
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {pendingItems.map((req) => (
          <div key={req.id} className="bg-white p-5 rounded-3xl shadow-soft border border-slate-50 hover:border-blue-200 transition-all group">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{req.id}</span>
                  <StatusBadge status={req.status} />
                  <PriorityBadge priority={req.priority} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{req.name}</h3>
                <p className="text-xs text-slate-400 font-bold uppercase mt-1">
                  Setor: {req.department} • Solicitado em: {new Date(req.requestDate).toLocaleDateString('pt-BR')}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right mr-4 hidden md:block">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Quantidade</p>
                  <p className="text-lg font-black text-slate-700">{req.quantity} <span className="text-xs text-slate-400 uppercase">{req.unit}</span></p>
                </div>
                
                <button 
                  onClick={() => onOpenTco(req.id)}
                  className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-xs flex items-center gap-2 hover:bg-blue-600 transition-all shadow-lg shadow-slate-200 active:scale-95"
                >
                  <Calculator className="w-4 h-4" /> ANALISAR TCO <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
