import { fetchJson } from './api';

export const taxApi = {
  calculateQuote: async (payload: any): Promise<any> => {
    return fetchJson('/tax/calculate-quote', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  createSnapshot: async (quoteId: string, payload: any): Promise<any> => {
    return fetchJson(`/tax/quotes/${quoteId}/tax-snapshot`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getSnapshots: async (quoteId: string): Promise<any> => {
    return fetchJson(`/tax/quotes/${quoteId}/tax-snapshots`, {
      method: 'GET',
    });
  },

  recalculateTax: async (quoteId: string, payload: { buyerCompanyId: string }): Promise<any> => {
    return fetchJson(`/tax/quotes/${quoteId}/recalculate-tax`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
