import React, { useState } from 'react';
import { Requisition, Status } from '../types';
import { StatusBadge } from './StatusBadge';
import { Eye, ChevronLeft, ChevronRight, Filter } from 'lucide-react';

interface HistoryTableProps {
  requisitions: Requisition[];
  onItemClick?: (item: Requisition) => void;
}

const ITEMS_PER_PAGE = 8;

export const HistoryTable: React.FC<HistoryTableProps> = ({ requisitions, onItemClick }) => {
  const [statusFilter, setStatusFilter] = useState<Status | 'Todas'>('Todas');
  const [currentPage, setCurrentPage] = useState(1);

  // 1. Filtragem
  const filteredItems = requisitions.filter(req => {
    if (statusFilter === 'Todas') return true;
    return req.status === statusFilter;
  });

  // 2. Paginação
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentItems = filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const statusOptions: (Status | 'Todas')[] = ['Todas', 'Solicitado', 'Cotando', 'Aprovado', 'Comprado', 'Entregue', 'Rejeitado'];

  return (
    <div className="bg-white rounded-[2.5rem] shadow-soft border border-slate-50 overflow-hidden flex flex-col h-full min-h-[600px]">
      
      {/* Header com Filtros */}
      <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
          Histórico de Itens
          <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-[10px]">{filteredItems.length}</span>
        </h3>
        
        <div className="flex items-center gap-3">
          <div className="relative group">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition-colors" />
            <select 
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as any); setCurrentPage(1); }}
              className="pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none focus:border-blue-400 hover:border-blue-200 transition-all cursor-pointer appearance-none shadow-sm"
            >
              {statusOptions.map(opt => <option key={opt} value={opt}>{opt === 'Todas' ? 'Todos os Status' : opt}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto custom-scrollbar flex-1">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-slate-50 bg-slate-50/20">
              <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Item / Descrição</th>
              <th className="px-8 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Qtd</th>
              <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
              <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Solicitante</th>
              <th className="px-8 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {currentItems.map((req) => (
              <tr 
                key={req.id} 
                onClick={() => onItemClick && onItemClick(req)}
                className="group hover:bg-blue-50/40 transition-all duration-200 cursor-pointer"
              >
                <td className="px-8 py-5 whitespace-nowrap">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors">{req.name}</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{req.id} • {req.department}</span>
                  </div>
                </td>
                <td className="px-8 py-5 whitespace-nowrap text-center">
                  <span className="text-xs font-extrabold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg">
                    {req.quantity} <span className="text-slate-400 font-bold ml-0.5">{req.unit}</span>
                  </span>
                </td>
                <td className="px-8 py-5 whitespace-nowrap">
                  <StatusBadge status={req.status} />
                </td>
                <td className="px-8 py-5 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500 shadow-sm border border-slate-200">
                      {req.requester.charAt(0)}
                    </div>
                    <span className="text-xs font-bold text-slate-600">{req.requester}</span>
                  </div>
                </td>
                <td className="px-8 py-5 whitespace-nowrap text-right">
                   <button className="p-2 rounded-xl text-slate-300 group-hover:text-blue-500 group-hover:bg-blue-100/50 transition-colors">
                      <Eye className="w-5 h-5" />
                   </button>
                </td>
              </tr>
            ))}
            {filteredItems.length === 0 && (
              <tr><td colSpan={5} className="text-center py-24 text-slate-400 font-bold text-sm">Nenhum resultado encontrado com este filtro.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Paginação */}
      {totalPages > 1 && (
        <div className="px-8 py-4 border-t border-slate-50 bg-slate-50/30 flex justify-between items-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Página {currentPage} de {totalPages}
          </p>
          <div className="flex gap-2">
            <button 
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-white hover:border-blue-200 hover:text-blue-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-slate-200 transition-all bg-white shadow-sm"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button 
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-white hover:border-blue-200 hover:text-blue-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-slate-200 transition-all bg-white shadow-sm"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
