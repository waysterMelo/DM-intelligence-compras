const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export async function fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    let message = 'API Error';
    try {
      const errorData = await response.json();
      message = errorData.message || message;
    } catch {
      // Ignore
    }
    throw new Error(`[${response.status}] ${message}`);
  }

  return response.json();
}
