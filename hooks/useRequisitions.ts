import { useState, useEffect } from 'react';
import { Requisition, Department, Status, Priority, SupplierQuote, StatsData } from '../types';

// Pegamos a URL do nosso backend da variável de ambiente que configuramos no .env
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const useRequisitions = () => {
  // Agora começamos com a lista vazia, pois os dados virão do banco
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [stats, setStats] = useState<StatsData>({
    totalRequests: 0,
    totalSpent: 0,
    pendingCount: 0,
    completedCount: 0
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<Status | 'Todos'>('Todos');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'Todos'>('Todos');
  const [deptFilter, setDeptFilter] = useState<Department | 'Todos'>('Todos');

  // useEffect: Executa assim que a tela abre pela primeira vez
  useEffect(() => {
    fetchData();
  }, []);

  // Função principal para carregar dados do Backend
  const fetchData = async () => {
    try {
      // Carrega as Requisições e as Estatísticas em paralelo para ser mais rápido
      const [reqRes, statsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/requisitions`),
        fetch(`${API_BASE_URL}/stats`)
      ]);

      const reqData = await reqRes.json();
      const statsData = await statsRes.json();

      setRequisitions(reqData);
      setStats(statsData);
    } catch (error) {
      console.error("Erro ao carregar dados do servidor:", error);
    }
  };

  // Envia o texto do WhatsApp para o Backend fazer o "Parse Inteligente"
  const addRequisitionsFromText = async (text: string, department: Department) => {
    try {
      const response = await fetch(`${API_BASE_URL}/requisitions/bulk-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, department })
      });

      if (response.ok) {
        // Se deu certo, recarregamos a lista e os números do dashboard
        fetchData();
      }
    } catch (error) {
      console.error("Erro ao importar itens:", error);
    }
  };

  // Atualiza o Status (ex: de solicitado para cotando ou comprado)
  const updateStatus = async (id: string, newStatus: Status, finalCost?: number, paymentTerms?: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/requisitions/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: newStatus, 
          finalCost, 
          paymentTerms 
        })
      });

      if (response.ok) {
        fetchData(); // Atualiza a tela com o novo status
      }
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
    }
  };

  // Atualiza as cotações de fornecedores
  const updateQuotes = async (id: string, quotes: SupplierQuote[]) => {
    try {
      const response = await fetch(`${API_BASE_URL}/requisitions/${id}/quotes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quotes)
      });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Erro ao atualizar cotações:", error);
    }
  };

  // Remove permanentemente uma requisição do banco
  const deleteRequisition = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/requisitions/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Erro ao deletar requisição:", error);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('Todos');
    setPriorityFilter('Todos');
    setDeptFilter('Todos');
  };

  // A lógica de filtros continua igual, agindo sobre a lista que veio do banco
  const filteredRequisitions = requisitions.filter(req => {
    const matchesSearch = req.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.requester.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'Todos' || req.status === statusFilter;
    const matchesPriority = priorityFilter === 'Todos' || req.priority === priorityFilter;
    const matchesDept = deptFilter === 'Todos' || req.department === deptFilter;

    return matchesSearch && matchesStatus && matchesPriority && matchesDept;
  });

  const isFilterActive = searchTerm !== '' || statusFilter !== 'Todos' || priorityFilter !== 'Todos' || deptFilter !== 'Todos';

  return {
    requisitions,
    filteredRequisitions,
    stats, // Retornamos as estatísticas vindas do banco também
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    deptFilter,
    setDeptFilter,
    clearFilters,
    isFilterActive,
    addRequisitionsFromText,
    updateStatus,
    updateQuotes,
    deleteRequisition
  };
};