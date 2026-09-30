import { AIChatResponse } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_URL as string) || 'http://127.0.0.1:8000/api';

export async function sendAIChatMessage(
  message: string,
  context?: Record<string, any>
): Promise<AIChatResponse> {
  const res = await fetch(`${API_BASE_URL}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, context: context || {} }),
  });
  if (!res.ok) {
    throw new Error(`AI chat failed with status: ${res.status}`);
  }
  return res.json();
}
