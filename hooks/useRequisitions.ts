import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Department,
  ManualInvoiceInput,
  Priority,
  QuickPurchaseInput,
  Requisition,
  StatsData,
  Status,
  SupplierQuote,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const readError = async (response: Response, fallback: string) => {
  const payload = await response.json().catch(() => null);
  const message = Array.isArray(payload?.message) ? payload.message.join(', ') : payload?.message;
  return message || fallback;
};

export const useRequisitions = () => {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [stats, setStats] = useState<StatsData>({ totalRequests: 0, totalSpent: 0, pendingCount: 0, completedCount: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<Status | 'Todos'>('Todos');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'Todos'>('Todos');
  const [deptFilter, setDeptFilter] = useState<Department | 'Todos'>('Todos');

  const fetchData = useCallback(async () => {
    const [reqRes, statsRes] = await Promise.all([
      fetch(`${API_BASE_URL}/requisitions`),
      fetch(`${API_BASE_URL}/stats`),
    ]);
    if (!reqRes.ok || !statsRes.ok) throw new Error('Não foi possível carregar os dados de Compras.');
    setRequisitions(await reqRes.json());
    setStats(await statsRes.json());
  }, []);

  useEffect(() => {
    fetchData().catch(error => console.error('Erro ao carregar dados:', error));
  }, [fetchData]);

  const jsonRequest = async (path: string, method: string, body?: unknown) => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) throw new Error(await readError(response, 'Não foi possível concluir a operação.'));
    await fetchData();
  };

  const addRequisitionsFromText = (text: string, department: Department) =>
    jsonRequest('/requisitions/bulk-import', 'POST', { text, department });

  const updateStatus = (id: string, status: Status, finalCost?: number, paymentTerms?: string) =>
    jsonRequest(`/requisitions/${id}/status`, 'PATCH', { status, finalCost, paymentTerms });

  const updateQuotes = (id: string, quotes: SupplierQuote[]) =>
    jsonRequest(`/requisitions/${id}/quotes`, 'PUT', quotes);

  const createQuickPurchase = (data: QuickPurchaseInput) =>
    jsonRequest('/requisitions/quick-purchase', 'POST', data);

  const createManualInvoice = (id: string, data: ManualInvoiceInput) =>
    jsonRequest(`/requisitions/${id}/invoice/manual`, 'POST', data);

  const createXmlInvoice = async (id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    const response = await fetch(`${API_BASE_URL}/requisitions/${id}/invoice/xml`, { method: 'POST', body: form });
    if (!response.ok) throw new Error(await readError(response, 'Não foi possível importar o XML.'));
    await fetchData();
  };

  const reconcileInvoice = (id: string, acceptDivergence = false) =>
    jsonRequest(`/requisitions/${id}/reconcile`, 'POST', { acceptDivergence });

  const deleteRequisition = (id: string) => jsonRequest(`/requisitions/${id}`, 'DELETE');

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('Todos');
    setPriorityFilter('Todos');
    setDeptFilter('Todos');
  };

  const filteredRequisitions = useMemo(() => requisitions.filter(req => {
    const query = searchTerm.toLowerCase();
    return (req.name.toLowerCase().includes(query) || req.requester.toLowerCase().includes(query) || req.id.toLowerCase().includes(query))
      && (statusFilter === 'Todos' || req.status === statusFilter)
      && (priorityFilter === 'Todos' || req.priority === priorityFilter)
      && (deptFilter === 'Todos' || req.department === deptFilter);
  }), [deptFilter, priorityFilter, requisitions, searchTerm, statusFilter]);

  return {
    requisitions,
    filteredRequisitions,
    stats,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    deptFilter,
    setDeptFilter,
    clearFilters,
    isFilterActive: searchTerm !== '' || statusFilter !== 'Todos' || priorityFilter !== 'Todos' || deptFilter !== 'Todos',
    addRequisitionsFromText,
    updateStatus,
    updateQuotes,
    createQuickPurchase,
    createManualInvoice,
    createXmlInvoice,
    reconcileInvoice,
    deleteRequisition,
  };
};
