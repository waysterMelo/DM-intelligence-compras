import React, { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Eye, Filter, PackageSearch, UserRound } from 'lucide-react';
import { Requisition, Status } from '../types';
import { StatusBadge } from './StatusBadge';

interface HistoryTableProps {
  requisitions: Requisition[];
  onItemClick?: (item: Requisition) => void;
}

const ITEMS_PER_PAGE = 8;
const statusOptions: (Status | 'Todas')[] = ['Todas', 'Solicitado', 'Cotando', 'Aprovado', 'Comprado', 'Entregue', 'Rejeitado'];
const formatDate = (date: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${date}T12:00:00`));

export const HistoryTable: React.FC<HistoryTableProps> = ({ requisitions, onItemClick }) => {
  const [statusFilter, setStatusFilter] = useState<Status | 'Todas'>('Todas');
  const [currentPage, setCurrentPage] = useState(1);

  const filteredItems = requisitions.filter(requisition => statusFilter === 'Todas' || requisition.status === statusFilter);
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const safePage = Math.min(currentPage, Math.max(totalPages, 1));
  const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
  const currentItems = filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) setCurrentPage(newPage);
  };

  return (
    <section className="flex min-h-[520px] flex-col overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-soft" aria-labelledby="history-title">
      <header className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/50 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="history-title" className="text-lg font-black text-slate-900">Histórico de itens</h2>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black text-blue-700">{filteredItems.length}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Clique em um item para consultar valores, fornecedor e movimentações.</p>
        </div>

        <label className="relative block w-full sm:w-48">
          <span className="sr-only">Filtrar histórico por status</span>
          <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <select
            aria-label="Filtrar histórico por status"
            value={statusFilter}
            onChange={event => {
              setStatusFilter(event.target.value as Status | 'Todas');
              setCurrentPage(1);
            }}
            className="min-h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-xs font-black text-slate-600 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            {statusOptions.map(option => <option key={option} value={option}>{option === 'Todas' ? 'Todos os status' : option}</option>)}
          </select>
        </label>
      </header>

      <div className="grid flex-1 content-start gap-3 p-3 sm:p-5 lg:grid-cols-2">
        {currentItems.map(requisition => (
          <article key={requisition.id} className="min-w-0">
            <button
              type="button"
              onClick={() => onItemClick?.(requisition)}
              aria-label={`Abrir detalhes de ${requisition.name}`}
              className="group flex h-full min-h-48 w-full flex-col rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-100/60 focus:outline-none focus:ring-4 focus:ring-blue-100"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words text-sm font-black leading-5 text-slate-900 transition group-hover:text-blue-700">{requisition.name}</h3>
                  <p className="mt-1 truncate font-mono text-[9px] font-bold uppercase tracking-wide text-slate-400">{requisition.id}</p>
                </div>
                <StatusBadge status={requisition.status} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center gap-1.5 text-slate-400"><PackageSearch className="h-3.5 w-3.5" /><span className="text-[9px] font-black uppercase tracking-wide">Quantidade</span></div>
                  <p className="mt-1 text-sm font-black text-slate-800">{requisition.quantity} <span className="text-xs text-slate-500">{requisition.unit}</span></p>
                </div>
                <div className="min-w-0 rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center gap-1.5 text-slate-400"><UserRound className="h-3.5 w-3.5" /><span className="text-[9px] font-black uppercase tracking-wide">Solicitante</span></div>
                  <p className="mt-1 truncate text-sm font-black text-slate-800">{requisition.requester}</p>
                </div>
              </div>

              <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-black uppercase tracking-wide text-slate-500">{requisition.department}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-[10px] font-bold text-slate-400"><CalendarDays className="h-3.5 w-3.5" />{formatDate(requisition.requestDate)}</p>
                </div>
                <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-black text-blue-600"><Eye className="h-4 w-4" />Ver detalhes</span>
              </div>
            </button>
          </article>
        ))}

        {filteredItems.length === 0 && (
          <div className="col-span-full flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 px-6 text-center">
            <PackageSearch className="mb-3 h-9 w-9 text-slate-300" />
            <p className="text-sm font-black text-slate-700">Nenhum item neste status</p>
            <p className="mt-1 text-xs text-slate-400">Escolha outro filtro para consultar o histórico.</p>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <footer className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-5 py-4 sm:px-6">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Página {safePage} de {totalPages}</p>
          <div className="flex gap-2">
            <button type="button" aria-label="Página anterior" onClick={() => handlePageChange(safePage - 1)} disabled={safePage === 1} className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 transition hover:border-blue-200 hover:text-blue-600 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" aria-label="Próxima página" onClick={() => handlePageChange(safePage + 1)} disabled={safePage === totalPages} className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 transition hover:border-blue-200 hover:text-blue-600 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </footer>
      )}
    </section>
  );
};
