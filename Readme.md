# 🚀 IWOE-RCS Frontend

Frontend for the **Intelligent Warehouse Optimization Engine (IWOE)**.

This application provides a web-based dashboard for warehouse monitoring, fleet management (AMR/AGV), warehouse visualization, and future Robot Control System (RCS) integration.

---

## ✨ Features

- 📊 Executive Dashboard
- 🤖 Fleet Control (AMR/AGV)
- 📦 Warehouse Map
- 📈 Warehouse Analytics
- 📡 Ready for REST API & WebSocket integration
- 🌙 Modern responsive UI (React + Tailwind CSS)

---

## 🛠️ Tech Stack

- React 19
- Vite 7
- React Router DOM
- Tailwind CSS 4
- Lucide React

---

## 📁 Project Structure

```text
frontend/
├── public/
├── src/
│   ├── components/
│   ├── pages/
│   ├── services/
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── index.html
├── package.json
├── package-lock.json
└── vite.config.js
```

---

## 📥 Installation

Clone the repository

```bash
git clone https://github.com/Zandness/IWOE_RCS.git
```

Go to the frontend directory

```bash
cd IWOE_RCS/frontend
```

Install dependencies

```bash
npm install
```

If you encounter dependency conflicts, try:

```bash
npm install --legacy-peer-deps
```

---

## ▶️ Run Development Server

```bash
npm run dev
```

Open your browser:

```
http://localhost:5173
```

---

## 🏗️ Build for Production

```bash
npm run build
```

Preview the production build

```bash
npm run preview
```

---

## 📄 Available Scripts

| Command | Description |
|----------|-------------|
| `npm install` | Install project dependencies |
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |

---

## 📡 Future Integration

The frontend is designed to communicate with the backend using:

### REST API

```
GET    /dashboard
GET    /warehouse
GET    /robots
POST   /optimization/run
POST   /robot/{id}/pause
POST   /robot/{id}/resume
POST   /robot/{id}/charge
```

### WebSocket

```
ws://localhost:8000/ws
```

Used for:

- Live robot telemetry
- Robot status updates
- Warehouse events
- Fleet monitoring

---

## 📌 Roadmap

- [x] Dashboard UI
- [x] Fleet Control UI
- [x] Warehouse Map UI
- [ ] FastAPI Integration
- [ ] WebSocket Integration
- [ ] Robot Control System (RCS) Integration
- [ ] Warehouse Optimization Engine
- [ ] Authentication & User Roles
- [ ] Performance Analytics

---

## 👥 Contributors

- Wichayada Thammawongchai
- IWOE-RCS Development Team

---

## 📄 License

This project was developed as part of a **Cooperative Education Project** in **Robotics and AI Engineering**, King Mongkut's Institute of Technology Ladkrabang (KMITL).
