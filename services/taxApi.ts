import { fetchJson } from './api';

export const taxApi = {
  calculateQuote: async (payload: any): Promise<any> => {
    return fetchJson('/tax/calculate-quote', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
