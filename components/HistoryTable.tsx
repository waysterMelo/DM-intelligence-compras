import React, { useState } from 'react';
import {
  BadgeCheck,
  Ban,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardClock,
  Eye,
  Filter,
  PackageCheck,
  PackageSearch,
  SearchCheck,
  ShoppingBag,
  UserRound
} from 'lucide-react';
import { Requisition, Status } from '../types';
import { StatusBadge } from './StatusBadge';

interface HistoryTableProps {
  requisitions: Requisition[];
  onItemClick?: (item: Requisition) => void;
}

const ITEMS_PER_PAGE = 8;
const statusOptions: (Status | 'Todas')[] = ['Todas', 'Solicitado', 'Cotando', 'Aprovado', 'Comprado', 'Entregue', 'Rejeitado'];
const formatDate = (date: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${date}T12:00:00`));
const statusVisuals = {
  Solicitado: {
    icon: ClipboardClock,
    card: 'border-blue-200/90 bg-gradient-to-br from-blue-50 via-blue-50 to-sky-100/80 hover:border-blue-300 hover:shadow-blue-200/70',
    iconWrap: 'bg-blue-600 text-white shadow-blue-200',
    panel: 'border-blue-100 bg-white/70'
  },
  Cotando: {
    icon: SearchCheck,
    card: 'border-cyan-200/90 bg-gradient-to-br from-cyan-50 via-sky-50 to-blue-100/80 hover:border-cyan-300 hover:shadow-cyan-200/70',
    iconWrap: 'bg-cyan-600 text-white shadow-cyan-200',
    panel: 'border-cyan-100 bg-white/70'
  },
  Aprovado: {
    icon: BadgeCheck,
    card: 'border-emerald-200/90 bg-gradient-to-br from-emerald-50 via-green-50 to-teal-100/75 hover:border-emerald-300 hover:shadow-emerald-200/70',
    iconWrap: 'bg-emerald-600 text-white shadow-emerald-200',
    panel: 'border-emerald-100 bg-white/70'
  },
  Comprado: {
    icon: ShoppingBag,
    card: 'border-violet-200/90 bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-100/80 hover:border-violet-300 hover:shadow-violet-200/70',
    iconWrap: 'bg-violet-600 text-white shadow-violet-200',
    panel: 'border-violet-100 bg-white/70'
  },
  Entregue: {
    icon: PackageCheck,
    card: 'border-teal-200/90 bg-gradient-to-br from-teal-50 via-emerald-50 to-green-100/80 hover:border-teal-300 hover:shadow-teal-200/70',
    iconWrap: 'bg-teal-600 text-white shadow-teal-200',
    panel: 'border-teal-100 bg-white/70'
  },
  Rejeitado: {
    icon: Ban,
    card: 'border-rose-200/90 bg-gradient-to-br from-rose-50 via-red-50 to-orange-100/70 hover:border-rose-300 hover:shadow-rose-200/70',
    iconWrap: 'bg-rose-600 text-white shadow-rose-200',
    panel: 'border-rose-100 bg-white/70'
  }
} as const;

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
    <section className="flex min-h-[520px] flex-col overflow-hidden rounded-[2rem] border border-blue-100/80 bg-white/60 shadow-soft backdrop-blur-sm" aria-labelledby="history-title">
      <header className="flex flex-col gap-4 border-b border-blue-100/80 bg-gradient-to-r from-white/90 to-blue-50/80 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="history-title" className="text-lg font-black text-slate-900">Histórico de itens</h2>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black text-blue-700">{filteredItems.length}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Clique em um item para consultar valores, fornecedor e movimentações.</p>
        </div>

        <label className="relative block w-full sm:w-48">
          <span className="sr-only">Filtrar histórico por status</span>
          <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-400" />
          <select
            aria-label="Filtrar histórico por status"
            value={statusFilter}
            onChange={event => {
              setStatusFilter(event.target.value as Status | 'Todas');
              setCurrentPage(1);
            }}
            className="min-h-11 w-full appearance-none rounded-xl border border-blue-100 bg-white/90 pl-10 pr-4 text-xs font-black text-slate-600 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            {statusOptions.map(option => <option key={option} value={option}>{option === 'Todas' ? 'Todos os status' : option}</option>)}
          </select>
        </label>
      </header>

      <div className="grid flex-1 content-start gap-3 p-3 sm:p-5 2xl:grid-cols-2">
        {currentItems.map(requisition => {
          const visual = statusVisuals[requisition.status];
          const StatusIcon = visual.icon;

          return (
            <article key={requisition.id} className="min-w-0">
              <button
                type="button"
                onClick={() => onItemClick?.(requisition)}
                aria-label={`Abrir detalhes de ${requisition.name}`}
                className={`group flex h-full min-h-48 w-full flex-col rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-200/70 ${visual.card}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-md ${visual.iconWrap}`} aria-hidden="true">
                      <StatusIcon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="break-words text-sm font-black leading-5 text-slate-900 transition group-hover:text-blue-800">{requisition.name}</h3>
                      <p className="mt-1 truncate font-mono text-[9px] font-bold uppercase tracking-wide text-slate-500/80">{requisition.id}</p>
                    </div>
                  </div>
                  <StatusBadge status={requisition.status} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className={`rounded-xl border p-3 shadow-sm ${visual.panel}`}>
                    <div className="flex items-center gap-1.5 text-slate-400"><PackageSearch className="h-3.5 w-3.5" /><span className="text-[9px] font-black uppercase tracking-wide">Quantidade</span></div>
                    <p className="mt-1 text-sm font-black text-slate-800">{requisition.quantity} <span className="text-xs text-slate-500">{requisition.unit}</span></p>
                  </div>
                  <div className={`min-w-0 rounded-xl border p-3 shadow-sm ${visual.panel}`}>
                    <div className="flex items-center gap-1.5 text-slate-400"><UserRound className="h-3.5 w-3.5" /><span className="text-[9px] font-black uppercase tracking-wide">Solicitante</span></div>
                    <p className="mt-1 truncate text-sm font-black text-slate-800">{requisition.requester}</p>
                  </div>
                </div>

                <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-black uppercase tracking-wide text-slate-600">{requisition.department}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-[10px] font-bold text-slate-500"><CalendarDays className="h-3.5 w-3.5" />{formatDate(requisition.requestDate)}</p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-black text-blue-700"><Eye className="h-4 w-4" />Ver detalhes</span>
                </div>
              </button>
            </article>
          );
        })}

        {filteredItems.length === 0 && (
          <div className="col-span-full flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-blue-200 bg-blue-50/70 px-6 text-center">
            <PackageSearch className="mb-3 h-9 w-9 text-blue-300" />
            <p className="text-sm font-black text-slate-700">Nenhum item neste status</p>
            <p className="mt-1 text-xs text-slate-400">Escolha outro filtro para consultar o histórico.</p>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <footer className="flex items-center justify-between border-t border-blue-100/80 bg-blue-50/60 px-5 py-4 sm:px-6">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Página {safePage} de {totalPages}</p>
          <div className="flex gap-2">
            <button type="button" aria-label="Página anterior" onClick={() => handlePageChange(safePage - 1)} disabled={safePage === 1} className="rounded-xl border border-blue-100 bg-white p-2.5 text-slate-500 transition hover:border-blue-200 hover:text-blue-600 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" aria-label="Próxima página" onClick={() => handlePageChange(safePage + 1)} disabled={safePage === totalPages} className="rounded-xl border border-blue-100 bg-white p-2.5 text-slate-500 transition hover:border-blue-200 hover:text-blue-600 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </footer>
      )}
    </section>
  );
};
