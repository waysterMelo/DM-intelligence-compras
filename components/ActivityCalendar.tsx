import React, { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Requisition } from '../types';

interface ActivityCalendarProps {
  requisitions: Requisition[];
  onDayClick?: (date: string, items: Requisition[]) => void;
}

const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const weekDays = [['D', 'Dom'], ['S', 'Seg'], ['T', 'Ter'], ['Q', 'Qua'], ['Q', 'Qui'], ['S', 'Sex'], ['S', 'Sáb']];

export const ActivityCalendar: React.FC<ActivityCalendarProps> = ({ requisitions, onDayClick }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, index) => index + 1);
  const padding = Array.from({ length: firstDayOfMonth }, (_, index) => index);

  const activityMap = requisitions.reduce((accumulator: Record<string, Requisition[]>, requisition) => {
    if (!accumulator[requisition.requestDate]) accumulator[requisition.requestDate] = [];
    accumulator[requisition.requestDate].push(requisition);
    return accumulator;
  }, {});

  const getDayKey = (day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const today = new Date();
  const isToday = (day: number) => today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
  const monthActivity = days.reduce((total, day) => total + (activityMap[getDayKey(day)]?.length || 0), 0);
  const activeDays = days.filter(day => activityMap[getDayKey(day)]?.length).length;

  return (
    <section className="flex h-fit flex-col rounded-[2rem] border border-slate-100 bg-white p-4 shadow-soft sm:p-5" aria-labelledby="calendar-title">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><CalendarDays className="h-5 w-5" /></div>
          <div className="min-w-0">
            <h2 id="calendar-title" className="text-base font-black text-slate-900">Calendário</h2>
            <p className="truncate text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{monthNames[month]} {year}</p>
          </div>
        </div>
        <div className="flex gap-1">
          <button type="button" aria-label="Mês anterior" onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" aria-label="Próximo mês" onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </header>

      <div className="grid grid-cols-7 gap-1" aria-hidden="true">
        {weekDays.map(([short, full]) => (
          <div key={full} className="py-2 text-center text-[9px] font-black uppercase text-slate-400">
            <span className="sm:hidden">{short}</span><span className="hidden sm:inline">{full}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {padding.map(value => <span key={`padding-${value}`} aria-hidden="true" />)}
        {days.map(day => {
          const key = getDayKey(day);
          const dayItems = activityMap[key] || [];
          const hasActivity = dayItems.length > 0;
          const current = isToday(day);
          return (
            <button
              key={day}
              type="button"
              disabled={!hasActivity}
              onClick={() => onDayClick?.(key, dayItems)}
              aria-label={`${day} de ${monthNames[month]}${hasActivity ? `, ${dayItems.length} ${dayItems.length === 1 ? 'movimentação' : 'movimentações'}` : ', sem movimentações'}`}
              className={`relative flex min-h-10 items-center justify-center rounded-xl text-xs font-black transition sm:min-h-11 ${current ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : hasActivity ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 focus:ring-4 focus:ring-blue-100' : 'text-slate-500 disabled:opacity-100'} `}
            >
              {day}
              {hasActivity && (
                <span className={`absolute right-1 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5 text-[8px] ${current ? 'bg-white text-blue-700' : 'bg-blue-600 text-white'}`}>{dayItems.length}</span>
              )}
            </button>
          );
        })}
      </div>

      <footer className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <div>
          <p className="text-xs font-black text-slate-700">{monthActivity} {monthActivity === 1 ? 'movimentação' : 'movimentações'}</p>
          <p className="text-[10px] font-bold text-slate-400">em {activeDays} {activeDays === 1 ? 'dia' : 'dias'} do mês</p>
        </div>
        <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wide text-blue-600"><span className="h-2 w-2 rounded-full bg-blue-500" />Com atividade</span>
      </footer>
    </section>
  );
};
