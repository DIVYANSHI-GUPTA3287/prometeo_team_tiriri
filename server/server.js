const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const uuid = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });
const upload = multer({ dest: 'uploads/' });

// Replace with your Mongo URI
mongoose.connect('mongodb+srv://Divyanshi:div123@cluster0.zhdsakz.mongodb.net/prometeo?appName=Cluster0');

// Incident Model
const incidentSchema = new mongoose.Schema({
  type: { type: String, enum: ['Road Accident', 'Fire', 'Medical Emergency', 'Natural Disaster', 'Gas Leak', 'Infrastructure Failure', 'Traffic Blockage', 'Crime'] },
  description: String,
  location: { type: { type: String, default: 'Point' }, coordinates: [Number] }, // [lng, lat] for Mongo geo
  media: [String],
  timestamp: { type: Date, default: Date.now },
  uniqueId: String,
  severity: { type: String, enum: ['low', 'medium', 'high'] },
  verified: { type: String, default: 'Unverified' }, // Unverified, Needs Confirmation, Verified
  upvotes: { type: Number, default: 0 },
  trustScore: { type: Number, default: 0 },
  status: { type: String, default: 'open' },
  notes: String,
  assignedResource: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource' }
});
incidentSchema.index({ location: '2dsphere' });
const Incident = mongoose.model('Incident', incidentSchema);

// Resource Model
const resourceSchema = new mongoose.Schema({
  name: String,
  type: String, // e.g., Hospital, Fire Station
  location: { type: { type: String, default: 'Point' }, coordinates: [Number] },
  availability: { type: Boolean, default: true }
});
const Resource = mongoose.model('Resource', resourceSchema);

async function seedResources() {
  try {
    const count = await Resource.countDocuments({}).maxTimeMS(5000); // 5 sec timeout
    if (count === 0) {
      console.log('Seeding emergency resources...');
      await Resource.insertMany([
        { name: "AIIMS Hospital", type: "Hospital", location: { coordinates: [77.2100, 28.5672] } },
        { name: "Safdarjung Hospital", type: "Hospital", location: { coordinates: [77.2044, 28.5667] } },
        { name: "Connaught Place Fire Station", type: "Fire Brigade", location: { coordinates: [77.2172, 28.6304] } },
        { name: "Karol Bagh Fire Station", type: "Fire Brigade", location: { coordinates: [77.1900, 28.6500] } },
        { name: "CATS Ambulance HQ", type: "Ambulance", location: { coordinates: [77.2090, 28.6139] } },
        { name: "NDMA Delhi Unit", type: "Disaster Response", location: { coordinates: [77.2300, 28.6100] } }
      ]);
      console.log('Resources seeded successfully');
    }
  } catch (err) {
    console.log('Seed skipped (timeout or connection issue) - this is normal on Render free tier cold starts');
    // App continues running — no crash!
  }
}

// Call it
seedResources();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Report Incident
app.post('/api/incidents', upload.array('media'), async (req, res) => {
  const { type, description, lng, lat, severity } = req.body;
  const coordinates = [parseFloat(lng), parseFloat(lat)];
  const media = req.files ? req.files.map(f => `/uploads/${f.filename}`) : [];

  // De-duplication: Same type, within 300m, 10 min
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
  const duplicate = await Incident.findOne({
    type,
    location: { $near: { $geometry: { type: 'Point', coordinates }, $maxDistance: 300 } },
    timestamp: { $gte: tenMinAgo }
  });
  if (duplicate) return res.status(400).json({ error: 'Possible duplicate incident!' });

  const incident = new Incident({
    type, description, location: { coordinates }, media, severity, uniqueId: uuid.v4()
  });

  // Calculate trust score
  let trustScore = 0;
  if (media.length > 0) trustScore += 1;
  const nearby = await Incident.countDocuments({
    location: { $near: { $geometry: { type: 'Point', coordinates }, $maxDistance: 500 } },
    _id: { $ne: incident._id }
  });
  trustScore += nearby / 2 + incident.upvotes;
  incident.trustScore = trustScore;
  incident.verified = trustScore > 5 ? 'Verified' : trustScore >= 3 ? 'Needs Confirmation' : 'Unverified';

  // Auto-assign resource
  const resourceTypeMap = { 'Medical Emergency': 'Hospital', 'Fire': 'Fire Station', 'Road Accident': 'Ambulance' }; // Add more
  const targetType = resourceTypeMap[type] || 'Hospital';
  const nearest = await Resource.findOne({
    type: targetType,
    location: { $near: { $geometry: { type: 'Point', coordinates }, $maxDistance: 10000 } } // 10km
  });
  if (nearest) incident.assignedResource = nearest._id;

  await incident.save();
  io.emit('new-incident', incident);
  res.json(incident);
});

// Get Incidents with filters
app.get('/api/incidents', async (req, res) => {
  let query = {};
  if (req.query.type) query.type = req.query.type;
  if (req.query.startTime) query.timestamp = { $gte: new Date(req.query.startTime) };
  if (req.query.lat && req.query.lng && req.query.radius) {
    query.location = {
      $near: { $geometry: { type: 'Point', coordinates: [parseFloat(req.query.lng), parseFloat(req.query.lat)] }, $maxDistance: parseFloat(req.query.radius) * 1000 }
    };
  }
  const incidents = await Incident.find(query).populate('assignedResource', 'name type').sort({ timestamp: -1 });
  res.json(incidents);
});

// Upvote (updates score/verified)
app.patch('/api/incidents/:id/upvote', async (req, res) => {
  const incident = await Incident.findById(req.params.id);
  incident.upvotes += 1;
  incident.trustScore += 1; // Recalc simple
  incident.verified = incident.trustScore > 5 ? 'Verified' : incident.trustScore >= 3 ? 'Needs Confirmation' : 'Unverified';
  await incident.save();
  io.emit('update-incident', incident);
  res.json(incident);
});

// Admin Update
app.patch('/api/incidents/:id/admin', async (req, res) => {
  const { status, notes } = req.body;
  const incident = await Incident.findByIdAndUpdate(req.params.id, { status, notes }, { new: true }).populate('assignedResource');
  io.emit('update-incident', incident);
  res.json(incident);
});

server.listen(5000, () => console.log('Server on 5000'));