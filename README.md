# Blockchain Freelance Escrow

A milestone-based freelance payment DApp running on the Ethereum Sepolia testnet. Clients lock test ETH in a smart contract, freelancers submit milestone work, and payments are released after approval or dispute resolution.

## Live Demo

- Primary: <https://escrow.wuziran.fun/>
- Render backup: <https://freelance-escrow-front.onrender.com/>

The primary deployment is recommended. The Render backend may sleep after a period of inactivity. If the backup site cannot load data, open <https://freelance-escrow-api.onrender.com/api/escrows?page_size=1> and refresh the frontend after the service starts.

## Features

- MetaMask wallet connection
- Client, Freelancer, and Arbitrator roles
- Escrow creation and funding
- Milestone submission and payment release
- Dispute raising and arbitration
- Timeout refunds
- Project dashboard and transaction history
- Responsive interface for the MetaMask mobile browser

## Technology Stack

- **Smart Contract:** Solidity, Ethereum Sepolia
- **Frontend:** React, Vite, Mantine, Ethers.js
- **Backend:** Flask, Flask-SQLAlchemy
- **Database:** SQLite
- **Deployment:** Nginx, Gunicorn, Render

## Project Structure

```text
├── contracts/   # Solidity contract and compiled artifacts
├── backend/     # Flask API and SQLite models
├── frontend/    # React application
└── docs/        # Design documents, diagrams, and report
```

## Local Development

### Backend

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment and install dependencies:

```bash
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
python -m pip install -r requirements.txt
```

Copy `.env.example` to `.env`, then start the API:

```bash
python run.py
```

The backend runs at `http://127.0.0.1:61131`.

### Frontend

```bash
cd frontend
npm ci
```

Copy `.env.example` to `.env` and configure:

```dotenv
VITE_API_BASE_URL=/api
VITE_CONTRACT_ADDRESS=0x1aba804808190d83234548ac8408cde08087c6f3
```

Start the development server:

```bash
npm run dev
```

Open <http://localhost:61130/>. Vite proxies local `/api` requests to the Flask backend.

## Build and Check

```bash
cd frontend
npm run lint
npm run build
```

The production files are generated in `frontend/dist`.

## Deployment

The primary deployment serves the built frontend through Nginx and proxies `/api` to Gunicorn. Keep `VITE_API_BASE_URL=/api` for this same-origin setup.

For the Render backup, deploy `backend` as a Web Service and `frontend` as a Static Site.

Frontend environment variable:

```dotenv
VITE_API_BASE_URL=https://freelance-escrow-api.onrender.com/api
```

Backend environment variable:

```dotenv
CORS_ORIGINS=https://freelance-escrow-front.onrender.com
```

Vite environment variables are applied during the build, so the frontend must be rebuilt after changing them. SQLite on Render is intended only for the backup demonstration because service restarts may remove local database data; blockchain funds and states remain on Sepolia.

## Documentation

- [Assignment report](docs/SC6113-Individual-Assignment-Report.md)
- [System architecture](docs/architecture.md)
- [API specification](docs/api-spec.md)
- [Data model](docs/data-model.md)
