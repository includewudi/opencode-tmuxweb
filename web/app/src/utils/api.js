// Helper function for API requests with credential and content-type handling
async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// Groups API
export async function fetchGroups(profileKey) {
  return apiFetch(`/api/groups?profile_key=${encodeURIComponent(profileKey)}`);
}

export async function createGroup(profileKey, groupName) {
  return apiFetch('/api/groups', {
    method: 'POST',
    body: JSON.stringify({ profile_key: profileKey, group_name: groupName })
  });
}

export async function updateGroup(id, data) {
  return apiFetch(`/api/groups/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

export async function deleteGroup(id) {
  return apiFetch(`/api/groups/${id}`, {
    method: 'DELETE'
  });
}

// Profiles API
export async function fetchProfiles() {
  return apiFetch('/api/profiles');
}

export async function createProfile(data) {
  return apiFetch('/api/profiles', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function updateProfile(id, data) {
  return apiFetch(`/api/profiles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

export async function deleteProfile(id) {
  return apiFetch(`/api/profiles/${id}`, {
    method: 'DELETE'
  });
}

export async function fetchOrder(profileId) {
  return apiFetch(`/api/profiles/${profileId}/order`);
}

export async function saveOrder(profileId, orderData) {
  return apiFetch(`/api/profiles/${profileId}/order`, {
    method: 'PUT',
    body: JSON.stringify(orderData)
  });
}

// Sessions API
export async function assignSessionToGroup(sessionName, profileKey, groupId) {
  return apiFetch(`/api/sessions/${encodeURIComponent(sessionName)}/group`, {
    method: 'PUT',
    body: JSON.stringify({ profile_key: profileKey, group_id: groupId })
  });
}

// Panes API
export async function fetchPaneStatus(profileKey, paneKeys) {
  const keysParam = Array.isArray(paneKeys) ? paneKeys.join(',') : paneKeys;
  return apiFetch(`/api/panes/status?profile_key=${encodeURIComponent(profileKey)}&pane_keys=${encodeURIComponent(keysParam)}`);
}

export async function updatePaneStatus(profileKey, paneKey, status) {
  return apiFetch('/api/panes/status', {
    method: 'PUT',
    body: JSON.stringify({ profile_key: profileKey, pane_key: paneKey, status })
  });
}

// Tasks API
export async function fetchTasks(paneKey) {
  return apiFetch(`/api/panes/${encodeURIComponent(paneKey)}/tasks`);
}

export async function createTask(paneKey, title) {
  return apiFetch(`/api/panes/${encodeURIComponent(paneKey)}/tasks`, {
    method: 'POST',
    body: JSON.stringify({ title })
  });
}

export async function updateTask(id, data) {
  return apiFetch(`/api/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

export async function completeTask(id) {
  return apiFetch(`/api/tasks/${id}/complete`, {
    method: 'POST'
  });
}

export async function fetchTaskDetail(id) {
  return apiFetch(`/api/tasks/${id}/detail`);
}

// Summaries API
export async function summarizeTask(taskId) {
  return apiFetch(`/api/tasks/${taskId}/summarize`, {
    method: 'POST'
  });
}

export async function loadSummary(taskId, summaryId) {
  return apiFetch(`/api/tasks/${taskId}/load-summary`, {
    method: 'POST',
    body: JSON.stringify({ summary_id: summaryId })
  });
}

export async function fetchSummaryCandidates(paneKey) {
  return apiFetch(`/api/panes/${encodeURIComponent(paneKey)}/summary-candidates`);
}

// Tmux tree API
export async function fetchTmuxTree() {
  return apiFetch('/api/tmux/tree');
}
