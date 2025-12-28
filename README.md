# Prometeo 2026 - Real-Time Incident Reporting & Resource Coordination Platform

## Overview

In emergencies, every second counts. This platform addresses critical challenges in response systems by enabling instant citizen reporting, smart verification, early alerts to nearby emergency services, and efficient responder coordination. Built for Prometeo 2026's theme of Renewal, Resilience, and Self-Sufficiency, it reduces response time and resource wastage.

**Live Demo**: [Insert Vercel URL here after deployment, e.g., https://prometeo-team-tiriri.vercel.app]

## The Critical Challenges (As Per Problem Statement)

- Delayed & unreliable reporting
- Duplicate & false reports
- Lack of real-time visibility
- Poor prioritisation
- Delayed emergency preparedness

Our platform solves these with a unified, real-time system.

## Key Features

### Citizen-Side
- Easy incident reporting with 8 types, description, auto-GPS location, and image upload (mandatory for high-severity)
- Automatic timestamps & unique IDs
- Live incident feed with filters
- Transparent status tracking (Unverified → Early Alert Sent → Verified → Resolved)

### Verification & De-duplication
- Detect duplicates: Same type + location (300–500m) + time (10 min)
- Trust score: Image presence + community upvotes + nearby reports
- Multi-stage states with early alerts for high-risk

### Early Access Emergency Alerts
- Trigger for high-severity + image + GPS
- Identify nearby services (hospitals, fire brigades, ambulances, disaster units, municipal teams) within 3–5km
- Send preliminary "Standby" alerts (simulated in logs; prod: SMS/email)
- Cancel alerts if flagged false

### Full Resource Dispatch
- On verification: Assign nearest available services
- Admin override/reassign
- Update service status to Responding

### Responder & Admin Dashboard
- Secure admin toggle (prod: full login)
- Live list with priority sorting (severity + urgency)
- Labels: Early Alert, Verified
- Actions: Confirm/Dispatch, Cancel Alert, Mark Responding/Resolved

### Map View
- Interactive India-centered map (Leaflet + OpenStreetMap)
- Incident pins with colors (Grey: Unverified, Orange: Early Alert, Red: Verified)
- Nearby emergency services pins

## Tech Stack

Frontend: HTML5/CSS3/Vanilla JS for dynamic UI, Leaflet.js for maps, Socket.io for real-time  
Backend: Node.js + Express for APIs  
Database: MongoDB for geo queries (alternative: PostgreSQL/Redis for scale)  
Other: Multer for images, UUID for IDs  

 (MVP built lightweight; future: TypeScript, Python/FastAPI, Docker/Kubernetes for production)

## Setup & Run Locally

1. Clone repo: `git clone [your-repo-url]`
2. Backend: `cd server` → `npm install` → `node server.js` (set MONGO_URI in code)
3. Frontend: Open `client/index.html` with Live Server (VS Code extension)
4. Access: http://127.0.0.1:5500

## Deployment

Frontend: Vercel (static) — select `client` folder  
Backend: Render.com (Web Service) — select `server` folder, add MONGO_URI env  

Live Demo: [Insert URL]

## Impact & Future Potential
- Faster preparedness with early alerts to hospitals/fire brigades/ambulances
- Reduced confusion/duplication
- Scalable for real-world integration
- Future: Push popups for nearby users, AI severity, mobile app, official API tie-ins

## Acknowledgments
Prometeo 2026 by IIT Jodhpur, Sponsored by Anginat. Built with passion for impact.

*Renewal, Resilience, and Self-Sufficiency*