const socket = io('http://localhost:5000');
let incidents = [];
let map;
let markers = {};
let isAdmin = false;

const types = ['Road Accident', 'Fire', 'Medical Emergency', 'Natural Disaster', 'Gas Leak', 'Infrastructure Failure', 'Traffic Blockage', 'Crime'];

// Initialize map
map = L.map('map').setView([20.5937, 78.9629], 5); // India center
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// Toggle view
document.getElementById('toggle-view').onclick = () => {
  isAdmin = !isAdmin;
  document.getElementById('citizen-view').style.display = isAdmin ? 'none' : 'block';
  document.getElementById('admin-view').style.display = isAdmin ? 'block' : 'none';
  document.getElementById('toggle-view').textContent = isAdmin ? 'Citizen View' : 'Admin View';
  renderIncidents();
};

// Get location
document.getElementById('get-location').onclick = () => {
  navigator.geolocation.getCurrentPosition(pos => {
    document.getElementById('lat').value = pos.coords.latitude.toFixed(6);
    document.getElementById('lng').value = pos.coords.longitude.toFixed(6);
    map.setView([pos.coords.latitude, pos.coords.longitude], 13);
  }, () => alert('Location access denied'));
};

// Report form
document.getElementById('report-form').onsubmit = async (e) => {
  e.preventDefault();
  const severity = document.getElementById('severity').value;
  const media = document.getElementById('media').files;
  if (severity === 'high' && media.length === 0) {
    alert('High severity requires at least one image!');
    return;
  }

  const formData = new FormData();
  formData.append('type', document.getElementById('type').value);
  formData.append('description', document.getElementById('description').value);
  formData.append('lat', document.getElementById('lat').value);
  formData.append('lng', document.getElementById('lng').value);
  formData.append('severity', severity);
  for (let file of media) formData.append('media', file);

  const res = await fetch('http://localhost:5000/api/incidents', {
    method: 'POST',
    body: formData
  });

  if (res.ok) {
    alert('Incident reported successfully!');
    e.target.reset();
  } else {
    const data = await res.json();
    alert(data.error || 'Failed to report');
  }
};

// Load incidents
async function loadIncidents() {
  const res = await fetch('http://localhost:5000/api/incidents');
  incidents = await res.json();
  renderIncidents();
}

// Render
function renderIncidents() {
  const list = document.getElementById('incident-list');
  list.innerHTML = '';
  Object.values(markers).forEach(m => map.removeLayer(m));
  markers = {};

  // Sort if admin
  if (isAdmin) {
    incidents.sort((a, b) => {
      const score = i => (i.severity === 'high' ? 3 : i.severity === 'medium' ? 2 : 1) + i.trustScore;
      return score(b) - score(a);
    });
  }

  incidents.forEach(inc => {
    const li = document.createElement('li');
    const statusClass = inc.verified === 'Verified' ? 'verified' : inc.verified === 'Needs Confirmation' ? 'needs-confirmation' : 'unverified';
    li.className = statusClass;

    li.innerHTML = `
      <strong>${inc.type}</strong> - ${inc.description}<br>
      <small>${new Date(inc.timestamp).toLocaleString()}</small><br>
      Severity: <strong>${inc.severity.toUpperCase()}</strong> | 
      Trust Score: ${inc.trustScore} | Status: ${inc.verified}<br>
      ${inc.assignedResource ? `Assigned: ${inc.assignedResource.name}` : 'No resource assigned'}<br>
      Status: ${inc.status} ${inc.notes ? '| Notes: ' + inc.notes : ''}<br>
      ${inc.media.map(url => `<img src="http://localhost:5000${url}">`).join('')}
      <button onclick="upvote('${inc._id}')">👍 Upvote (${inc.upvotes})</button>
      ${isAdmin ? `
        <select onchange="updateStatus('${inc._id}', this.value)">
          <option ${inc.status==='open'?'selected':''}>open</option>
          <option ${inc.status==='in-progress'?'selected':''}>in-progress</option>
          <option ${inc.status==='resolved'?'selected':''}>resolved</option>
        </select>
        <input placeholder="Notes" value="${inc.notes||''}" onblur="updateNotes('${inc._id}', this.value)">
      ` : ''}
    `;

    list.appendChild(li);

    // Map marker
    const marker = L.marker([inc.location.coordinates[1], inc.location.coordinates[0]])
      .addTo(map)
      .bindPopup(li.innerHTML);
    markers[inc._id] = marker;
  });
}

// Upvote
function upvote(id) {
  fetch(`http://localhost:5000/api/incidents/${id}/upvote`, { method: 'PATCH' });
}

// Admin functions
function updateStatus(id, status) {
  fetch(`http://localhost:5000/api/incidents/${id}/admin`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
}

function updateNotes(id, notes) {
  fetch(`http://localhost:5000/api/incidents/${id}/admin`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes })
  });
}

// Real-time
socket.on('new-incident', inc => { incidents.unshift(inc); renderIncidents(); });
socket.on('update-incident', updated => {
  incidents = incidents.map(i => i._id === updated._id ? updated : i);
  renderIncidents();
});

// Initial load
loadIncidents();
document.getElementById('sort-priority').onclick = () => renderIncidents();