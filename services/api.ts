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
    let data;
    try {
      data = await response.json();
      message = data.message || message;
    } catch {
      // Ignore
    }
    // Lança o erro com a mensagem do nestjs (que pode ser um array de string se class-validator falhar)
    throw new Error(Array.isArray(message) ? message.join('; ') : message);
  }

  return response.json();
}
