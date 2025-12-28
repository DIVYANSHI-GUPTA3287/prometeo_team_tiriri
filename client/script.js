let isAdmin = false;
let incidents = [];
let map;
let markers = {};

const socket = io('http://localhost:5000');

const modal = document.getElementById('modal');
const fab = document.getElementById('open-modal');
const closeBtn = document.querySelector('.close');

fab.onclick = () => modal.style.display = 'flex';
closeBtn.onclick = () => modal.style.display = 'none';
window.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };

map = L.map('map').setView([20.5937, 78.9629], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// Get location
document.getElementById('get-location').onclick = () => {
  navigator.geolocation.getCurrentPosition(pos => {
    document.getElementById('lat').value = pos.coords.latitude.toFixed(6);
    document.getElementById('lng').value = pos.coords.longitude.toFixed(6);
    map.setView([pos.coords.latitude, pos.coords.longitude], 13);
  }, () => alert('Location denied'));
};

// Report form submit (keep your existing or use this)
document.getElementById('report-form').onsubmit = async (e) => {
  e.preventDefault();
  const severity = document.getElementById('severity').value;
  const media = document.getElementById('media').files;
  if (severity === 'high' && media.length === 0) return alert('Image required for high severity!');

  const formData = new FormData();
  formData.append('type', document.getElementById('type').value);
  formData.append('description', document.getElementById('description').value);
  formData.append('lat', document.getElementById('lat').value);
  formData.append('lng', document.getElementById('lng').value);
  formData.append('severity', severity);
  for (let file of media) formData.append('media', file);

  const res = await fetch('http://localhost:5000/api/incidents', { method: 'POST', body: formData });
  if (res.ok) {
    alert('Reported successfully!');
    modal.style.display = 'none';
    e.target.reset();
  } else {
    alert('Error reporting');
  }
};

// Render incidents (replace your old function)
function renderIncidents() {
  document.getElementById('count').textContent = incidents.length;
  const container = document.getElementById('incident-cards');
  container.innerHTML = '';

  // Priority sort for admin
  if (isAdmin) {
    incidents.sort((a, b) => {
      const prio = { high: 3, medium: 2, low: 1 };
      return (prio[b.severity] + b.trustScore) - (prio[a.severity] + a.trustScore);
    });
  }

  incidents.forEach(inc => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h3>${inc.type}</h3>
      <p>${inc.description}</p>
      <div class="severity ${inc.severity}">${inc.severity.toUpperCase()}</div>
      <div class="status ${inc.verified.toLowerCase().replace(' ', '-')}">${inc.verified}</div>
      <small>${new Date(inc.timestamp).toLocaleString('en-IN')}</small>
      ${inc.media.map(m => `<img src="http://localhost:5000${m}">`).join('')}
      <button onclick="upvote('${inc._id}')">Upvote (${inc.upvotes})</button>
    `;
    container.appendChild(card);

    const color = inc.verified === 'Verified' ? '#10b981' : inc.verified === 'Needs Confirmation' ? '#fb923c' : '#ef4444';
    L.circleMarker([inc.location.coordinates[1], inc.location.coordinates[0]], { radius: 10, color, fillOpacity: 0.8 })
      .addTo(map)
      .bindPopup(card.innerHTML);
  });
}

// Socket listeners
socket.on('new-incident', inc => { incidents.unshift(inc); renderIncidents(); });
socket.on('update-incident', updated => {
  incidents = incidents.map(i => i._id === updated._id ? updated : i);
  renderIncidents();
});

// Initial load
async function loadIncidents() {
  const res = await fetch('http://localhost:5000/api/incidents');
  incidents = await res.json();
  renderIncidents();
}
loadIncidents();
