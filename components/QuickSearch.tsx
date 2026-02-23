import React, { useState, useMemo } from 'react';
import { Requisition } from '../types';
import { Search, History, CheckCircle2, Store, Calendar } from 'lucide-react';

interface QuickSearchProps {
  requisitions: Requisition[];
}

export const QuickSearch: React.FC<QuickSearchProps> = ({ requisitions }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [displayLimit, setDisplayLimit] = useState(5);

  const results = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];

    const term = searchTerm.toLowerCase();
    
    return requisitions.filter(req => {
      const nameMatch = req.name.toLowerCase().includes(term);
      const supplierMatch = req.quotes?.some(q => q.supplierName.toLowerCase().includes(term));
      return nameMatch || supplierMatch;
    }).sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());
  }, [requisitions, searchTerm]);

  // Reset limit on new search
  useMemo(() => setDisplayLimit(5), [searchTerm]);

  const displayedResults = results.slice(0, displayLimit);

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      
      <div className="bg-white p-8 rounded-[2.5rem] shadow-soft border border-slate-50 mb-8 text-center relative overflow-hidden">
        {/* ... (header remains same) ... */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500"></div>
        
        <div className="max-w-2xl mx-auto relative z-10">
          <h2 className="text-2xl font-extrabold text-slate-900 mb-2 tracking-tight">Inteligência de Preços</h2>
          <p className="text-slate-500 mb-8 font-medium">Pesquise o histórico de compras para encontrar fornecedores e últimas bases de preço.</p>
          
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
            <div className="relative">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-6 w-6 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
              <input
                autoFocus
                type="text"
                placeholder="Ex: Rolamento, Luva, Parafuso ou Nome do Fornecedor..."
                className="w-full pl-14 pr-6 py-5 bg-white border-2 border-slate-100 rounded-2xl text-lg font-bold text-slate-800 placeholder-slate-300 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50/50 transition-all shadow-xl shadow-slate-200/50"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {searchTerm.length >= 2 ? (
        <div className="flex-1 pb-12">
          {displayedResults.length > 0 ? (
            <div className="flex flex-col gap-6">
              <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                Exibindo {displayedResults.length} de {results.length} registros encontrados
              </p>
              
              {displayedResults.map((req) => (
                <div key={req.id} className="bg-white rounded-[2rem] p-6 shadow-soft border border-slate-50 hover:shadow-lg transition-all group">
                  <div className="flex flex-col md:flex-row gap-6">
                    
                    <div className="md:w-1/3 flex flex-col justify-center border-b md:border-b-0 md:border-r border-slate-50 pb-4 md:pb-0 md:pr-6">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {formatDate(req.requestDate)}
                        </span>
                        <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                          {req.id}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 leading-snug group-hover:text-blue-600 transition-colors">{req.name}</h3>
                      <p className="text-sm text-slate-400 font-bold mt-1">{req.quantity} {req.unit} • {req.department}</p>
                    </div>

                    <div className="md:w-1/3 flex flex-col justify-center bg-emerald-50/50 rounded-2xl p-4 border border-emerald-100/50">
                      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-3 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Última Compra
                      </p>
                      
                      {req.finalCost ? (
                        <div>
                          <p className="text-2xl font-extrabold text-emerald-700 tracking-tight">{formatCurrency(req.finalCost)} <span className="text-[10px] text-emerald-500 font-bold">/ {req.unit}</span></p>
                          {req.quotes && req.quotes.find(q => q.isSelected) ? (
                            <p className="text-xs font-bold text-emerald-600 mt-1 flex items-center gap-1">
                              <Store className="w-3 h-3" /> {req.quotes.find(q => q.isSelected)?.supplierName}
                            </p>
                          ) : (
                            <p className="text-xs font-bold text-emerald-600/60 mt-1 italic">Fornecedor não registrado</p>
                          )}
                          <p className="text-[10px] text-emerald-500/70 font-black mt-2 uppercase tracking-tighter">
                            Total do Pedido: {formatCurrency(req.finalCost * req.quantity)}
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-slate-400 italic text-sm font-medium">
                          <History className="w-4 h-4" />
                          Ainda em negociação
                        </div>
                      )}
                    </div>

                    <div className="md:w-1/3 flex flex-col justify-center pl-2">
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 pl-2">
                         Outras Cotações na Época
                       </p>
                       <div className="space-y-2">
                         {req.quotes && req.quotes.length > 0 ? (
                           req.quotes.map((quote, idx) => (
                             <div key={idx} className={`flex justify-between items-center p-2 rounded-lg text-xs ${quote.isSelected ? 'bg-emerald-100/50 text-emerald-800 font-bold border border-emerald-100' : 'bg-slate-50 text-slate-500 font-medium'}`}>
                               <span className="truncate max-w-[120px]">{quote.supplierName || 'Fornecedor s/ nome'}</span>
                               <span>{formatCurrency(quote.price)}</span>
                             </div>
                           ))
                         ) : (
                           <p className="text-xs text-slate-300 italic pl-2">Sem concorrentes registrados.</p>
                         )}
                       </div>
                    </div>

                  </div>
                </div>
              ))}

              {results.length > displayLimit && (
                <button 
                  onClick={() => setDisplayLimit(prev => prev + 5)}
                  className="w-full py-4 bg-slate-100 text-slate-500 font-bold uppercase tracking-widest rounded-2xl hover:bg-blue-50 hover:text-blue-600 transition-colors"
                >
                  Carregar mais resultados ({results.length - displayLimit} restantes)
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 opacity-50">
              <Search className="w-12 h-12 mb-4 text-slate-300" />
              <p className="font-bold text-lg">Nenhum histórico encontrado para "{searchTerm}"</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
           <Store className="w-24 h-24 mb-6 text-slate-100" />
           <p className="font-bold text-slate-400 text-lg">Busque por item ou fornecedor</p>
           <p className="text-sm mt-2 max-w-md text-center">O sistema irá varrer todas as compras passadas e cotações rejeitadas para te dar uma base de preço.</p>
        </div>
      )}
    </div>
  );
};