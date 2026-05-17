# PropOS

<div align="center">
  <img width="1200" height="475" alt="PropOS Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
  
  **The All-in-One Operating System for Real Estate Investors**
  
  Find undervalued deals • Manage properties effortlessly • Instantly match with cash buyers
  
  **Close deals faster. Stop juggling tools.**
</div>

## ✨ What is PropOS?

PropOS is a comprehensive SaaS platform purpose-built for real estate investors, wholesalers, and deal-makers. It combines powerful tools for **acquisition**, **property management**, **disposition/liquidity**, and **billing** into one unified, multi-tenant workspace.

Stop switching between spreadsheets, CRMs, listing sites, and buyer lists. PropOS brings everything together in a clean, modern interface.

### Core Pillars

- **🛠 Operations (Manage)** — Portfolio management, tenant tracking, maintenance, financials
- **📈 Acquisition** — Deal sourcing, undervalued property analysis, lead management
- **⚡ Liquidity (Sell)** — Buyer matching, cash buyer network, wholesale & flip disposition
- **💳 Revenue/Billing** — Subscription management, invoicing, revenue tracking

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+ recommended)
- A Google account for authentication
- Firebase project (configured via provided files)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/youngslim4985-sketch/PropOS-.git
   cd PropOS-
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   - Copy `.env.example` to `.env.local`
   - Add your `GEMINI_API_KEY` (for AI features)
   - Configure Firebase credentials (see `firebase-applet-config.json` and related files)

4. **Run the app**
   ```bash
   npm run dev
   ```

5. **Build for production**
   ```bash
   npm run build
   npm start
   ```

## 🛠 Tech Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Base UI
- **Backend**: Express + Firebase (Auth + Firestore) + Server-side Gemini integration
- **Animations**: Motion (Framer Motion)
- **Charts**: Recharts + D3
- **Styling**: Tailwind + custom dark "terminal-inspired" theme with gold accents
- **Multi-tenancy**: Custom workspace/tenant isolation

## Features

- **Google Authentication** with multi-tenant workspace support
- **Real-time updates** via Firestore
- **AI-powered insights** (Gemini integration)
- **Role-based access** and workspace invitations
- **Responsive design** with professional dark UI
- **Billing & subscription** management (Stripe ready)
- **Modular pillar architecture** for easy extension

## Project Structure

```
PropOS-/
├── src/
│   ├── components/     # Reusable UI + Pillar-specific components
│   ├── lib/            # Firebase, utilities, contexts
│   └── App.tsx         # Main application
├── components/ui/      # shadcn/ui components
├── lib/                # Shared utilities
├── firebase-*.json     # Firebase configuration
├── firestore.rules     # Security rules
└── server.ts           # Express server
```

## Roadmap

- [ ] Advanced deal analyzer with AI valuation
- [ ] Property listing import (MLS, etc.)
- [ ] Cash buyer marketplace enhancements
- [ ] Mobile app (PWA improvements)
- [ ] Advanced reporting & analytics
- [ ] More AI agents for automation

## Contributing

This is an early-stage project. Contributions, feedback, and feature requests are welcome!

1. Fork the repo
2. Create a feature branch
3. Submit a PR

## License

MIT License (or specify if proprietary elements apply).

---

**Built with ❤️ for real estate investors who move fast.**

*PropOS — Proprietary Real Estate Operating System*
