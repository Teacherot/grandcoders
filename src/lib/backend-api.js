const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export async function getBackendHealth() {
  const response = await fetch(`${API_BASE_URL}/health`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Backend health check failed with status ${response.status}`);
  }

  return response.json();
}
