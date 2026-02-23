
import React from 'react';
import { X, Trophy, Calendar, Store, CreditCard, Package, Calculator, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { Requisition } from '../types';
import { StatusBadge } from './StatusBadge';

interface ItemDetailsModalProps {
  data: Requisition | null;
  onClose: () => void;
}

export const ItemDetailsModal: React.FC<ItemDetailsModalProps> = ({ data, onClose }) => {
  if (!data) return null;

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '---';
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? 'Data Inválida' : date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  // Estado do Item
  const isFinalized = data.finalCost !== null && data.finalCost !== undefined && data.finalCost > 0;
  const finalUnit = data.finalCost || 0;
  
  // Dados de Cotação
  const winningQuote = data.quotes?.find(q => q.isSelected);
  // Se não tem cotação vencedora explícita, tenta pegar a de menor preço para comparação ou usa o finalUnit
  const benchmarkPrice = winningQuote ? winningQuote.price : (data.quotes && data.quotes.length > 0 ? Math.min(...data.quotes.map(q => q.price)) : finalUnit);
  
  // Cálculos de Saving (Apenas se finalizado)
  // Saving = (Preço de Referência - Preço Pago) * Quantidade
  const diffUnit = Math.max(0, benchmarkPrice - finalUnit);
  const totalSaving = diffUnit * data.quantity;
  const totalFinal = finalUnit * data.quantity;
  
  const hasSaving = totalSaving > 0;
  const savingPercent = benchmarkPrice > 0 ? ((diffUnit / benchmarkPrice) * 100).toFixed(1) : '0';

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-5xl border border-white overflow-hidden relative flex flex-col max-h-[90vh]">
        
        <div className="p-10 pb-6 border-b border-slate-50 flex justify-between items-start bg-slate-50/30">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[10px] font-black text-white uppercase tracking-widest bg-slate-900 px-3 py-1 rounded-full">
                {data.id}
              </span>
              <StatusBadge status={data.status} />
            </div>
            <h2 className="text-3xl font-black text-slate-900 leading-tight">{data.name}</h2>
            <p className="text-sm text-slate-500 font-bold mt-2 flex items-center gap-2">
               <span className="text-blue-600">{data.department}</span> 
               <span className="text-slate-300">•</span> 
               Solicitado por {data.requester}
            </p>
          </div>
          <button onClick={onClose} className="p-3 rounded-2xl hover:bg-white text-slate-300 hover:text-rose-500 transition-all shadow-sm border border-transparent hover:border-slate-100">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="overflow-y-auto custom-scrollbar p-10 pt-8">
          
          <div className="mb-10">
             <div className="flex justify-between items-end mb-4 px-2">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Performance da Negociação</h3>
                {isFinalized && hasSaving && (
                   <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full flex items-center gap-1">
                      <ArrowDownCircle className="w-3.5 h-3.5" /> {savingPercent}% de Redução
                   </span>
                )}
             </div>

             <div className="bg-slate-900 text-white rounded-[2rem] p-8 relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-16 translate-x-16"></div>
                
                <div className="grid grid-cols-2 gap-8 relative z-10 border-b border-white/10 pb-6 mb-6">
                   <div>
                      <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Oferta Inicial (Referência)</p>
                      <p className="text-xl font-bold">{formatCurrency(benchmarkPrice)}</p>
                   </div>
                   <div className="text-right">
                      <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Preço Fechado Unitário</p>
                      <p className="text-xl font-black text-blue-400">
                        {isFinalized ? formatCurrency(finalUnit) : 'Em Negociação'}
                      </p>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-8 relative z-10">
                   <div>
                      <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Total Investido</p>
                      <p className="text-2xl font-black">
                        {isFinalized ? formatCurrency(totalFinal) : '---'}
                      </p>
                   </div>
                   <div className="text-right">
                      <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${hasSaving ? 'text-emerald-400' : 'text-slate-400'}`}>
                        Saving Total
                      </p>
                      <p className={`text-4xl font-black ${hasSaving ? 'text-emerald-400' : 'text-slate-500'}`}>
                         {isFinalized ? formatCurrency(totalSaving) : '---'}
                      </p>
                   </div>
                </div>

                {isFinalized && hasSaving && (
                   <div className="mt-4 p-3 bg-white/5 rounded-xl border border-white/10">
                     <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        <Calculator className="w-3 h-3" /> Memória de Cálculo
                     </div>
                     <p className="text-xs text-slate-300 font-mono">
                        ({formatCurrency(benchmarkPrice)} - {formatCurrency(finalUnit)}) × {data.quantity} {data.unit} = {formatCurrency(totalSaving)}
                     </p>
                   </div>
                )}

                {data.paymentTerms && (
                   <div className="mt-6 p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <CreditCard className="w-5 h-5 text-blue-400" />
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Faturamento</span>
                      </div>
                      <span className="text-sm font-black text-white">{data.paymentTerms}</span>
                   </div>
                )}
             </div>
          </div>

          <div className="mb-10">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 ml-2">Detalhamento Técnico e Fiscal</h3>
            <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden overflow-x-auto">
              {data.quotes && data.quotes.length > 0 ? (
                <table className="w-full min-w-[600px]">
                  <thead className="bg-slate-50/50">
                    <tr>
                      <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase">Fornecedor</th>
                      <th className="px-4 py-4 text-right text-[10px] font-black text-slate-400 uppercase">Preço Unit.</th>
                      <th className="px-4 py-4 text-right text-[10px] font-black text-amber-500 uppercase">IPI (%)</th>
                      <th className="px-4 py-4 text-right text-[10px] font-black text-amber-500 uppercase">ICMS (%)</th>
                      <th className="px-4 py-4 text-right text-[10px] font-black text-amber-500 uppercase">PIS/COFINS</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black text-emerald-600 uppercase">Preço Líquido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.quotes.map((quote, idx) => {
                      const isWinner = quote.isSelected;
                      const netPrice = quote.price - (quote.creditIcms || 0) - (quote.creditPis || 0) - (quote.creditCofins || 0); // Aproximação simples se netCost não vier preenchido
                      const displayNet = quote.netCost || netPrice;

                      return (
                        <tr key={idx} className={isWinner ? 'bg-blue-50/30' : ''}>
                          <td className="px-6 py-4">
                            <span className={`text-sm font-bold ${isWinner ? 'text-blue-700' : 'text-slate-600'}`}>
                              {quote.supplierName || 'Fornecedor Desconhecido'} {isWinner && '🏆'}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right text-sm font-black text-slate-700">
                            {formatCurrency(quote.price)}
                          </td>
                           <td className="px-4 py-4 text-right text-xs font-bold text-slate-500">
                            {quote.ipiRate ? `${quote.ipiRate}%` : '-'}
                          </td>
                          <td className="px-4 py-4 text-right text-xs font-bold text-slate-500">
                            {quote.icmsRate ? `${quote.icmsRate}%` : '-'}
                          </td>
                          <td className="px-4 py-4 text-right text-xs font-bold text-slate-500">
                            {(quote.pisRate || 0) + (quote.cofinsRate || 0) > 0 ? `${((quote.pisRate||0) + (quote.cofinsRate||0)).toFixed(2)}%` : '-'}
                          </td>
                          <td className="px-6 py-4 text-right text-sm font-black text-emerald-600">
                            {formatCurrency(displayNet)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-slate-400 text-sm font-bold bg-slate-50">
                   Nenhum concorrente registrado.
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="bg-slate-50 p-4 rounded-2xl flex items-center gap-4 border border-slate-100">
                <Calendar className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase">Solicitado em</p>
                  <p className="text-xs font-bold text-slate-700">{formatDate(data.requestDate)}</p>
                </div>
             </div>
             <div className="bg-slate-50 p-4 rounded-2xl flex items-center gap-4 border border-slate-100">
                <Package className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase">Volume Comprado</p>
                  <p className="text-xs font-bold text-slate-700">{data.quantity} {data.unit}</p>
                </div>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};
