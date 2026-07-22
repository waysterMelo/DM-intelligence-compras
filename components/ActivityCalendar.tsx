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
    <section className="flex h-fit flex-col rounded-[2rem] border border-blue-300/40 bg-gradient-to-br from-[#071A3D] via-[#0B57D0] to-[#1877F2] p-4 text-white shadow-2xl shadow-blue-500/40 sm:p-5" aria-labelledby="calendar-title">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/30 bg-white/20 text-white shadow-lg shadow-blue-950/30"><CalendarDays className="h-5 w-5" /></div>
          <div className="min-w-0">
            <h2 id="calendar-title" className="text-base font-black text-white">Calendário</h2>
            <p className="truncate text-[10px] font-black uppercase tracking-[0.14em] text-blue-100">{monthNames[month]} {year}</p>
          </div>
        </div>
        <div className="flex gap-1">
          <button type="button" aria-label="Mês anterior" onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="rounded-xl border border-white/20 bg-white/10 p-2 text-white transition hover:border-white/40 hover:bg-white/20 focus:ring-4 focus:ring-white/20"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" aria-label="Próximo mês" onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="rounded-xl border border-white/20 bg-white/10 p-2 text-white transition hover:border-white/40 hover:bg-white/20 focus:ring-4 focus:ring-white/20"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </header>

      <div className="grid grid-cols-7 gap-1" aria-hidden="true">
        {weekDays.map(([short, full]) => (
          <div key={full} className="py-2 text-center text-[9px] font-black uppercase text-blue-100/90">
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
              className={`relative flex min-h-10 items-center justify-center rounded-xl border text-xs font-black transition sm:min-h-11 ${current ? 'border-white bg-white text-[#1877F2] shadow-lg shadow-blue-950/20' : hasActivity ? 'border-white/40 bg-white/90 text-[#1264cf] shadow-sm hover:-translate-y-0.5 hover:bg-white focus:ring-4 focus:ring-white/30' : 'border-transparent text-blue-50/90 disabled:opacity-100'}`}
            >
              {day}
              {hasActivity && (
                <span className={`absolute right-1 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5 text-[8px] ${current ? 'bg-[#0F5FC7] text-white' : 'bg-[#1877F2] text-white'}`}>{dayItems.length}</span>
              )}
            </button>
          );
        })}
      </div>

      <footer className="mt-4 flex items-center justify-between gap-3 border-t border-white/20 pt-4">
        <div>
          <p className="text-xs font-black text-white">{monthActivity} {monthActivity === 1 ? 'movimentação' : 'movimentações'}</p>
          <p className="text-[10px] font-bold text-blue-100">em {activeDays} {activeDays === 1 ? 'dia' : 'dias'} do mês</p>
        </div>
        <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wide text-white"><span className="h-2 w-2 rounded-full bg-white shadow-sm" />Com atividade</span>
      </footer>
    </section>
  );
};
