# TenderNova — Enterprise Tender Management System

**Streamline. Submit. Succeed.**

AI-powered enterprise tender management platform with role-based workflows, NIT analysis, approval chains, finance tracking, and compliance management.

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, Shadcn UI, React Query, Zustand |
| Backend | Node.js, Express.js, MongoDB, Mongoose, JWT, RBAC |
| Storage | AWS S3 |
| AI | OpenAI GPT, OCR (Tesseract), PDF/DOCX parsing, Rule Engine |

## Project Structure

```
Tender/
├── backend/                 # Express API
│   └── src/
│       ├── config/          # DB, env
│       ├── models/          # MongoDB schemas (11 models)
│       ├── controllers/     # Route handlers
│       ├── routes/          # API routes
│       ├── middleware/      # Auth, RBAC, audit, errors
│       ├── services/
│       │   ├── ai/          # OpenAI NIT extraction & risk
│       │   ├── ocr/         # PDF, DOCX, image OCR
│       │   ├── rules/       # Eligibility rule engine
│       │   ├── workflow/    # Approval workflow engine
│       │   ├── notification/# Real-time + email
│       │   ├── audit/       # Audit logging
│       │   └── s3/          # Document storage
│       └── scripts/         # DB seed
├── frontend/                # Next.js 15 app
│   └── src/
│       ├── app/             # Pages & dashboards
│       ├── components/      # UI, layouts, tender views
│       ├── lib/             # API client, utils
│       └── stores/          # Zustand auth store
└── docker-compose.yml       # MongoDB
```

## User Roles & Permissions

| Role | Key Capabilities |
|------|-----------------|
| **Executive** | Upload documents, AI NIT analysis, generate summary, submit to MD, request finance/compliance |
| **MD** | View summaries, approve/reject tenders |
| **Finance** | Approve EMD/BG/DD, upload payment proof, add transaction details |
| **Manager** | Upload compliance docs, approve compliance requests |

## Status Flow

```
DRAFT → NIT_ANALYZED → SUMMARY_GENERATED → PENDING_MD_APPROVAL
  → APPROVED_BY_MD / REJECTED_BY_MD
  → FINANCE_PENDING → FINANCE_APPROVED / FINANCE_REJECTED
  → MANAGER_PENDING → MANAGER_APPROVED → READY_FOR_BID
```

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB (or Docker)
- OpenAI API key (optional — mock data used without it)

### 1. Start MongoDB

```bash
docker-compose up -d
```

### 2. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run seed          # Creates demo users (skips existing)
npm run seed:reset    # Deletes & re-creates all seed users
npm run dev     # http://localhost:5001
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev     # http://localhost:3000
```

## Demo Accounts

All seed users use password: **password123**

| Role | Email | Name |
|------|-------|------|
| Executive | executive@tendererp.com | Rajesh Kumar |
| Executive | executive2@tendererp.com | Priya Sharma |
| MD | md@tendererp.com | Vikram Mehta |
| Finance | finance@tendererp.com | Anita Desai |
| Manager | manager@tendererp.com | Deepak Singh |

User definitions live in `backend/src/scripts/data/users.seed.ts`.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login |
| GET | `/api/tenders` | List tenders |
| POST | `/api/tenders/:id/documents` | Upload NIT document |
| POST | `/api/tenders/:id/analyze` | Run AI NIT analysis |
| GET | `/api/tenders/:id/nit-analysis` | Get analysis results |
| POST | `/api/tenders/:id/summary` | Generate AI summary |
| POST | `/api/tenders/:id/submit-md` | Submit for MD approval |
| POST | `/api/approvals/md/:tenderId` | MD approve/reject |
| POST | `/api/approvals/finance/:tenderId` | Create finance request |
| PATCH | `/api/approvals/finance/:id/decision` | Finance approve/reject |
| POST | `/api/approvals/compliance/:tenderId` | Request compliance |
| GET | `/api/notifications` | Get notifications |

## Environment Variables

See `backend/.env.example` and `frontend/.env.example` for all configuration options including AWS S3, OpenAI, SMTP, and company eligibility profile.

## Production extraction flow

```
PDF
  ↓
OCR (all pages → DocumentPage)
  ↓
OCR Normalization Engine (paragraphs → Label | Value | Page records)
  ↓
Dynamic Parameter Discovery Engine (all parameter:value pairs — no fixed schema)
  ↓
Store all parameters (DocumentDiscoveredParameter — no fixed schema)
  ↓
Mapping Engine (discovered → master fields: Tender No / Bid Reference No → Tender Number; EM / EMD → EMD Amount)
  ↓
Master Dataset populated from mapped business fields
  ↓
Validation (DocumentFieldValidation)
  ↓
NIT Analysis (mapped business fields by section; raw discovered parameters in appendix)
  ↓
Dashboard / tender UI (All Discovered Parameters table on tender detail)
```

Orchestrated by `tenderProductionPipeline` after OCR in the intelligence job.  
Debug tools: `/debug/ocr-normalization` (Step 1 — verify Label | Value | Page), `/debug/pages`, `/debug/discovered-parameters`, `/debug/fields`.

## Features

- **AI NIT Analysis** — Extract tender fields, risk assessment, eligibility scoring
- **Rule Engine** — Turnover, experience, OEM, EMD, MSME, GST, PAN, ISO checks
- **Approval Workflow** — MD → Finance → Manager → Ready for Bid
- **Real-time Updates** — Socket.io for live status changes
- **Notifications** — In-app + email
- **Audit Log** — Full action tracking with IP and value changes
- **Enterprise UI** — Role-based dashboards with professional NIT analysis views

## License

Proprietary — Enterprise use.
