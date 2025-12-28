let isAdmin = false;
let incidents = [];
let map;

const socket = io('https://prometeo-team-tiriri.onrender.com');

const modal = document.getElementById('modal');
const fab = document.getElementById('open-modal');
const closeBtn = document.querySelector('.close');

fab.onclick = () => modal.style.display = 'flex';
closeBtn.onclick = () => modal.style.display = 'none';
window.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };

// India default view
map = L.map('map').setView([20.5937, 78.9629], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Get location button
document.getElementById('get-location').onclick = () => {
  navigator.geolocation.getCurrentPosition(pos => {
    document.getElementById('lat').value = pos.coords.latitude.toFixed(6);
    document.getElementById('lng').value = pos.coords.longitude.toFixed(6);
    map.setView([pos.coords.latitude, pos.coords.longitude], 13);
  }, () => alert('Location access denied — enter coordinates manually'));
};

// Report form submit
document.getElementById('report-form').onsubmit = async (e) => {
  e.preventDefault();
  const severity = document.getElementById('severity').value;
  const media = document.getElementById('media').files;
  if (severity === 'high' && media.length === 0) {
    alert('Image required for high severity!');
    return;
  }

  const formData = new FormData();
  formData.append('type', document.getElementById('type').value);
  formData.append('description', document.getElementById('description').value);
  formData.append('lat', document.getElementById('lat').value);
  formData.append('lng', document.getElementById('lng').value);
  formData.append('severity', severity);
  for (let file of media) formData.append('media', file);

  try {
    const res = await fetch('https://prometeo-team-tiriri.onrender.com/api/incidents', {
      method: 'POST',
      body: formData
    });

    if (res.ok) {
      alert('Reported successfully!');
      modal.style.display = 'none';
      e.target.reset();
    } else {
      const error = await res.text();
      alert('Error reporting: ' + error);
    }
  } catch (err) {
    alert('Network error — check if backend is running');
  }
};

// Upvote function
function upvote(id) {
  fetch(`https://prometeo-team-tiriri.onrender.com/api/incidents/${id}/upvote`, { method: 'PATCH' })
    .catch(err => console.error('Upvote error:', err));
}

// Render incidents
function renderIncidents() {
  document.getElementById('count').textContent = incidents.length;
  const container = document.getElementById('incident-cards');
  container.innerHTML = '';

  // Priority sort for admin
  if (isAdmin) {
    incidents.sort((a, b) => {
      const prio = { high: 3, medium: 2, low: 1 };
      return (prio[b.severity] + (b.trustScore || 0)) - (prio[a.severity] + (a.trustScore || 0));
    });
  }

  incidents.forEach(inc => {
    const card = document.createElement('div');
    card.className = 'card';
    const statusClass = (inc.verified || 'Unverified').toLowerCase().replace(' ', '-');
    card.innerHTML = `
      <h3>${inc.type}</h3>
      <p>${inc.description}</p>
      <div class="severity ${inc.severity}">${inc.severity.toUpperCase()}</div>
      <div class="status ${statusClass}">${inc.verified || 'Unverified'}</div>
      <small>${new Date(inc.timestamp).toLocaleString('en-IN')}</small>
      ${inc.media ? inc.media.map(m => `<img src="https://prometeo-team-tiriri.onrender.com${m}">`).join('') : ''}
      <button onclick="upvote('${inc._id}')">Upvote (${inc.upvotes || 0})</button>
    `;
    container.appendChild(card);

    // Map pin color
    let color = '#ef4444'; // Unverified = red
    if (inc.verified === 'Needs Confirmation') color = '#fb923c';
    if (inc.verified === 'Verified') color = '#10b981';

    L.circleMarker([inc.location.coordinates[1], inc.location.coordinates[0]], {
      radius: 10,
      color: color,
      fillOpacity: 0.8
    }).addTo(map).bindPopup(card.innerHTML);
  });
}

// Real-time listeners
socket.on('new-incident', inc => {
  incidents.unshift(inc);
  renderIncidents();
});

socket.on('update-incident', updated => {
  incidents = incidents.map(i => i._id === updated._id ? updated : i);
  renderIncidents();
});

// Initial load
async function loadIncidents() {
  try {
    const res = await fetch('https://prometeo-team-tiriri.onrender.com/api/incidents');
    if (res.ok) {
      incidents = await res.json();
      renderIncidents();
    }
  } catch (err) {
    console.error('Failed to load incidents:', err);
  }
}
loadIncidents();