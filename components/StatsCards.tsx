
import React, { useState, useMemo } from 'react';
import { Requisition } from '../types';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar
} from 'recharts';
import { 
  TrendingUp, DollarSign, 
  PiggyBank, Calendar, ArrowUpRight, XCircle,
  Receipt, Store
} from 'lucide-react';

interface StatsCardsProps {
  requisitions: Requisition[];
}

export const StatsCards: React.FC<StatsCardsProps> = ({ requisitions }) => {
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const filteredData = useMemo(() => {
    return requisitions.filter(r => {
      if (startDate && r.requestDate < startDate) return false;
      if (endDate && r.requestDate > endDate) return false;
      return true;
    });
  }, [requisitions, startDate, endDate]);

  // CÁLCULOS FINANCEIROS CORRIGIDOS
  const completedItems = filteredData.filter(r => r.status === 'Comprado' || r.status === 'Entregue');
  
  const totalCost = completedItems.reduce((acc, curr) => {
    const cost = Math.round((curr.finalCost || 0) * curr.quantity * 100) / 100;
    return acc + cost;
  }, 0);

  const totalSaving = completedItems.reduce((acc, curr) => {
    // Busca a cotação vencedora para usar como base (Preço Inicial)
    const winningQuote = curr.quotes?.find(q => q.isSelected);
    
    // Se não tiver vencedora marcada, tenta pegar o maior preço das cotações como referência de "preço evitado" ou ignora
    // Mas o ideal é ter a vencedora. Vamos assumir que se está comprado, existe uma logica de preço inicial vs final.
    if (curr.finalCost) {
       const initialPrice = winningQuote ? winningQuote.price : curr.finalCost; // Fallback para não gerar saving falso se não achar a quote
       const finalPrice = curr.finalCost;
       
       const diffUnit = Math.max(0, initialPrice - finalPrice);
       const itemSaving = Math.round(diffUnit * curr.quantity * 100) / 100;
       return acc + itemSaving;
    }
    return acc;
  }, 0);

  // ROI da área de compras (Saving / (Gasto + Saving))
  const totalAvoided = totalCost + totalSaving;
  const savingPercentage = totalAvoided > 0 ? Math.round((totalSaving / totalAvoided) * 100) : 0;

  // Ticket Médio
  const averageTicket = completedItems.length > 0 ? totalCost / completedItems.length : 0;

  // Top Fornecedor (Curva A)
  const topSupplier = useMemo(() => {
    const map: Record<string, number> = {};
    completedItems.forEach(item => {
       const winningQuote = item.quotes?.find(q => q.isSelected);
       if(winningQuote && item.finalCost) {
         const cost = item.finalCost * item.quantity;
         const name = winningQuote.supplierName;
         map[name] = (map[name] || 0) + cost;
       }
    });
    
    let maxName = '---';
    let maxVal = 0;
    Object.entries(map).forEach(([name, val]) => {
      if(val > maxVal) {
        maxVal = val;
        maxName = name;
      }
    });
    return { name: maxName, value: maxVal };
  }, [completedItems]);

  // Dados para o Gráfico de Barras (Evolução Diária)
  const timelineData = useMemo(() => {
    const map = filteredData.reduce((acc: any, curr) => {
      const date = curr.requestDate;
      if(!date) return acc; // Ignora itens sem data
      
      if (!acc[date]) acc[date] = { date, saving: 0, gasto: 0 };
      
      const winningQuote = curr.quotes?.find(q => q.isSelected);
      
      if (curr.finalCost && (curr.status === 'Comprado' || curr.status === 'Entregue')) {
        const initialPrice = winningQuote ? winningQuote.price : curr.finalCost;
        const diffUnit = Math.max(0, initialPrice - curr.finalCost);
        const itemSaving = Math.round(diffUnit * curr.quantity * 100) / 100;
        
        acc[date].saving += itemSaving;
        acc[date].gasto += Math.round((curr.finalCost * curr.quantity) * 100) / 100;
      }
      return acc;
    }, {});

    return Object.values(map).sort((a: any, b: any) => a.date.localeCompare(b.date));
  }, [filteredData]);

  const deptData = filteredData.reduce((acc: any, curr) => {
    const existing = acc.find((d: any) => d.name === curr.department);
    const cost = Math.round(((curr.finalCost || 0) * curr.quantity) * 100) / 100;
    
    if (existing) {
      existing.realizado += cost;
    } else {
      acc.push({ name: curr.department, realizado: cost });
    }
    return acc;
  }, []).sort((a: any, b: any) => b.realizado - a.realizado);

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-4 rounded-3xl shadow-soft border border-slate-50">
        <div className="flex items-center gap-3 pl-2">
           <Calendar className="w-5 h-5 text-blue-600" />
           <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-widest">Relatório de Desempenho</h3>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100">
           <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 hidden md:inline-block">Filtrar Período:</span>
           
           <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-xl border border-slate-200 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-50 transition-all">
             <span className="text-[10px] font-bold text-slate-400 uppercase">De</span>
             <input 
               type="date" 
               className="text-xs font-bold text-slate-600 outline-none bg-transparent"
               value={startDate}
               onChange={(e) => setStartDate(e.target.value)}
             />
           </div>

           <span className="text-slate-300 font-bold text-xs">-</span>

           <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-xl border border-slate-200 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-50 transition-all">
             <span className="text-[10px] font-bold text-slate-400 uppercase">Até</span>
             <input 
               type="date" 
               className="text-xs font-bold text-slate-600 outline-none bg-transparent"
               value={endDate}
               onChange={(e) => setEndDate(e.target.value)}
             />
           </div>

           {(startDate || endDate) && (
             <button 
               onClick={() => { setStartDate(''); setEndDate(''); }}
               className="ml-1 p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
               title="Limpar Datas"
             >
               <XCircle className="w-4 h-4" />
             </button>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* CARD 1: SAVING (KPI Principal) */}
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-6 rounded-[2.5rem] shadow-lg shadow-emerald-200 text-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-20 transform translate-x-4 -translate-y-4 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform duration-700">
             <PiggyBank className="w-32 h-32" />
          </div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-6">
               <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl">
                 <TrendingUp className="w-6 h-6" />
               </div>
               <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold uppercase">
                 Negociação: {savingPercentage}%
               </div>
            </div>
            <p className="text-emerald-50 text-sm font-bold uppercase tracking-wider">Saving Gerado</p>
            <p className="text-3xl font-black mt-1">{formatCurrency(totalSaving)}</p>
            <div className="mt-4 flex items-center gap-1 text-emerald-100 text-xs font-medium">
               <ArrowUpRight className="w-4 h-4" /> Oferta Inicial vs Fechamento
            </div>
          </div>
        </div>

        {/* CARD 2: GASTO TOTAL */}
        <div className="bg-white p-6 rounded-[2.5rem] shadow-soft border border-slate-50">
          <div className="flex justify-between items-start mb-6">
             <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
               <DollarSign className="w-6 h-6" />
             </div>
          </div>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-wide">Gasto Realizado</p>
          <p className="text-3xl font-extrabold text-slate-900 mt-1">{formatCurrency(totalCost)}</p>
          <p className="text-xs text-slate-400 mt-2 font-medium">Volume total comprado no período</p>
        </div>

        {/* CARD 3: TICKET MÉDIO (Novo) */}
        <div className="bg-white p-6 rounded-[2.5rem] shadow-soft border border-slate-50">
           <div className="flex justify-between items-start mb-6">
             <div className="p-3 bg-violet-50 text-violet-600 rounded-2xl">
               <Receipt className="w-6 h-6" />
             </div>
          </div>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-wide">Ticket Médio</p>
          <p className="text-3xl font-extrabold text-slate-900 mt-1">{formatCurrency(averageTicket)}</p>
          <p className="text-xs text-violet-600 mt-2 font-bold uppercase tracking-tighter">Valor médio por pedido</p>
        </div>

        {/* CARD 4: TOP FORNECEDOR (Novo) */}
        <div className="bg-white p-6 rounded-[2.5rem] shadow-soft border border-slate-50">
          <div className="flex justify-between items-start mb-6">
             <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
               <Store className="w-6 h-6" />
             </div>
          </div>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-wide">Top Fornecedor</p>
          <p className="text-xl font-extrabold text-slate-900 mt-2 truncate" title={topSupplier.name}>
             {topSupplier.name}
          </p>
          <p className="text-xs text-amber-600 mt-2 font-bold uppercase tracking-tighter">
            {topSupplier.value > 0 ? `${formatCurrency(topSupplier.value)} em volume` : 'Sem dados no período'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-soft border border-slate-50">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Tendência de Negociação</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Saving acumulado por data de solicitação</p>
                </div>
              </div>
              <div className="h-80 w-full min-h-[320px] relative" style={{ height: 320, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 10, fill: '#94a3b8'}} 
                      tickFormatter={(str) => {
                          if (!str) return '-';
                          const d = new Date(str + 'T00:00:00');
                          return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
                      }}
                    />
                    <YAxis hide />
                    <Tooltip 
                      cursor={{fill: '#f8fafc'}}
                      contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}}
                      formatter={(val: number) => [formatCurrency(val), 'Saving']}
                    />
                    <Bar dataKey="saving" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
           </div>

           <div className="bg-white p-8 rounded-[2.5rem] shadow-soft border border-slate-50">
             <div className="mb-8 text-center">
                <h3 className="text-xl font-bold text-slate-800">Gasto por Setor</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Ranking de desembolso real</p>
             </div>
             <div className="space-y-6">
                {deptData.slice(0, 5).map((d: any, i: number) => {
                   const percentage = totalCost > 0 ? Math.round((d.realizado / totalCost) * 100) : 0;
                   return (
                     <div key={i} className="space-y-2">
                        <div className="flex justify-between text-sm">
                           <span className="font-bold text-slate-700">{d.name}</span>
                           <span className="text-slate-400 font-bold">{formatCurrency(d.realizado)}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                           <div className="h-full bg-blue-500 rounded-full" style={{ width: `${percentage}%` }}></div>
                        </div>
                     </div>
                   );
                })}
                {deptData.length === 0 && <p className="text-center text-slate-300 py-10">Nenhum dado financeiro.</p>}
             </div>
           </div>
      </div>
    </div>
  );
};
