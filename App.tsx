import React, { useState } from 'react';
import { Search, CheckCircle2, RotateCcw, Download, Briefcase } from 'lucide-react';
import { Requisition, Status, Department, Priority, SupplierQuote, Company } from './types';

// Custom Hook
import { useRequisitions } from './hooks/useRequisitions';

// Components
import { Sidebar } from './components/Sidebar';
import { SmartCreateModal } from './components/SmartCreateModal';
import { StatsCards } from './components/StatsCards';
import { HistoryTable } from './components/HistoryTable';
import { ActivityCalendar } from './components/ActivityCalendar';
import { DayDetailsModal } from './components/DayDetailsModal';
import { QuickSearch } from './components/QuickSearch';
import { ItemDetailsModal } from './components/ItemDetailsModal';
import { CompanyManager } from './components/CompanyManager';
import { PurchasingHub } from './components/PurchasingHub';
import { LoginScreen } from './components/LoginScreen';
import { QuickPurchases } from './components/QuickPurchases';

function App() {
  const [currentUser, setCurrentUser] = useState<{ name: string, company: Company } | null>(null);

  const { 
    requisitions, 
    filteredRequisitions, 
    stats, 
    addRequisitionsFromText, 
    updateStatus,
    updateQuotes,
    createQuickPurchase,
    createManualInvoice,
    createXmlInvoice,
    reconcileInvoice,
    deleteRequisition,
    searchTerm, setSearchTerm,
    statusFilter, setStatusFilter,
    deptFilter, setDeptFilter,
    isFilterActive, clearFilters
  } = useRequisitions();

  const [view, setView] = useState<'table' | 'dashboard' | 'quotes' | 'quick' | 'search' | 'companies'>('quotes');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedDayActivity, setSelectedDayActivity] = useState<{date: string, items: Requisition[]} | null>(null);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<Requisition | null>(null);

  if (!currentUser) {
    return <LoginScreen onLogin={(name, company) => setCurrentUser({ name, company })} />;
  }

  const displayData = filteredRequisitions;

  const handleSmartSubmit = async (text: string, department: Department) => {
    await addRequisitionsFromText(text, department);
    setView('quotes');
  };

  const getPageTitle = () => {
    switch(view) {
      case 'table': return 'Histórico de Itens';
      case 'dashboard': return 'Dashboard Gerencial';
      case 'search': return 'Busca Rápida';
      case 'companies': return 'Gestão de Empresas';
      case 'quick': return 'Compras Rápidas';
      default: return 'QG de Compras Estratégico';
    }
  };

  const getPageSubtitle = () => {
    switch(view) {
      case 'table': return 'Registro completo de todas as movimentações.';
      case 'dashboard': return 'Indicadores de performance e saving.';
      case 'search': return 'Pesquisa de preços e fornecedores históricos.';
      case 'companies': return 'Cadastro de fornecedores e premissas comerciais de TCO.';
      case 'quick': return 'Registre a compra agora e confira o custo quando a nota chegar.';
      default: return `Fila de Suprimentos: ${stats.pendingCount} itens aguardando ação.`;
    }
  };

  return (
    <div className="min-h-screen text-slate-800 flex font-sans bg-slate-50/50">
      
      <Sidebar 
        currentView={view as any} 
        onViewChange={(v: any) => setView(v)} 
        onNewRequest={() => setIsFormOpen(true)}
        requisitions={requisitions}
        currentUser={currentUser}
      />

      {/* Main Content */}
      <main className="mx-3 my-4 flex min-w-0 flex-1 flex-col overflow-hidden pb-24 transition-all duration-500 lg:ml-80 lg:mr-8 lg:my-8 lg:pb-0">
        
        {/* Top Header */}
        {view !== 'search' && (
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 pl-2">
             <div>
               <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
                 {getPageTitle()}
               </h1>
               <p className="text-sm text-slate-500 font-medium mt-1">
                 {getPageSubtitle()}
               </p>
             </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto no-scrollbar pr-1">
          {view === 'dashboard' ? (
            <StatsCards requisitions={requisitions} stats={stats} />
          ) : view === 'search' ? (
            <QuickSearch requisitions={requisitions} />
          ) : view === 'companies' ? (
            <CompanyManager />
          ) : view === 'quick' ? (
            <QuickPurchases
              requisitions={requisitions}
              onCreate={createQuickPurchase}
              onManualInvoice={createManualInvoice}
              onXmlInvoice={createXmlInvoice}
              onReconcile={reconcileInvoice}
              defaultRequester={currentUser.name.split('•')[0].trim()}
            />
          ) : view === 'quotes' ? (
            <PurchasingHub 
              requisitions={requisitions} 
              onUpdateStatus={updateStatus} 
              onUpdateQuotes={updateQuotes}
              onDelete={deleteRequisition}
            />
          ) : (
            <div className="grid items-start gap-5 rounded-[2.5rem] border border-slate-200 bg-gradient-to-br from-[#F8FAFC] via-[#F3F6FB] to-[#EEF2F7] p-3 shadow-inner shadow-slate-200/70 sm:p-4 xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="min-w-0">
                <HistoryTable 
                  requisitions={displayData} 
                  onItemClick={(item) => setSelectedHistoryItem(item)}
                />
              </div>
              <div className="min-w-0">
                  <ActivityCalendar 
                    requisitions={requisitions} 
                    onDayClick={(date, items) => setSelectedDayActivity({date, items})}
                  />
              </div>
            </div>
          )}
        </div>
      </main>

      <DayDetailsModal data={selectedDayActivity} onClose={() => setSelectedDayActivity(null)} />
      <ItemDetailsModal data={selectedHistoryItem} onClose={() => setSelectedHistoryItem(null)} />
      <SmartCreateModal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} onSubmit={handleSmartSubmit} />

    </div>
  );
}

export default App;
