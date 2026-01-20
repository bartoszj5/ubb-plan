const API_BASE = import.meta.env.VITE_API_URL || '';

export async function fetchFaculties() {
  const response = await fetch(`${API_BASE}/api/faculties`);
  if (!response.ok) throw new Error('Failed to fetch faculties');
  return response.json();
}

export async function fetchTreeBranch(branch: string, type: number = 1) {
  const response = await fetch(
    `${API_BASE}/api/tree?type=${type}&branch=${branch}&link=0&iPos=0`
  );
  if (!response.ok) throw new Error('Failed to fetch tree branch');
  return response.json();
}

export async function fetchSchedule(type: string, id: string, week?: number) {
  let url = `${API_BASE}/api/schedule/${type}/${id}`;
  if (week) {
    url += `?week=${week}`;
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch schedule');
  return response.json();
}
