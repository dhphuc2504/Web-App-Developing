export class ApiError extends Error {
  constructor(message, status = 0, errors = {}) { super(message); this.status = status; this.errors = errors; }
}
async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(path, { ...options, signal: controller.signal, headers: { 'Content-Type': 'application/json' } });
    const body = await response.json();
    if (!response.ok) throw new ApiError(body.message || 'Request failed.', response.status, body.errors);
    return body;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('The request could not be confirmed. Refresh the list before retrying.');
  } finally { clearTimeout(timer); }
}
export const api = {
  list: () => request('/api/students'),
  add: student => request('/api/students', { method: 'POST', body: JSON.stringify(student) }),
  move: (id, position, revision) => request(`/api/students/${encodeURIComponent(id)}/position`, { method: 'PATCH', body: JSON.stringify({ ...position, revision }) }),
};
