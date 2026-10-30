# TechPhones CRM — Indian Mobile Retail

TechPhones is a customer relationship manager for an Indian mobile-phone retailer. It helps shop staff keep customer details, phone inventory, completed sales, and customer follow-ups in one place. The stack is FastAPI, SQLAlchemy, MySQL, and a responsive HTML/CSS/JavaScript dashboard.

## What works

- Customer profiles with Indian mobile number validation, city, preferences, notes, sales count, and lifetime value
- Phone inventory with model, variant, selling price, and stock level
- Sales register linked to a customer and phone, with payment method, quantity, and stock deduction
- Customer follow-ups for calls, WhatsApp, store visits, email, and notes
- Dashboard metrics for monthly sales/revenue, customers, inventory, and follow-up reminders
- Search across customers, phone models, sales, and reminders
- Interactive API documentation at `/docs`

The project seeds a few illustrative customers, products, sales, and reminders on first run to demonstrate the CRM. Replace these sample records with your shop's real data before using it as a business system. This is a local demo, not a hosted, multi-user production CRM.

## Requirements

- Python 3.10+
- MySQL 8.0+
- pip

## Run locally

1. Create a MySQL database:

   ```sql
   CREATE DATABASE crm_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

2. Copy `.env.example` to `.env`, then set the MySQL credentials:

   ```env
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=crm_db
   SESSION_SECRET=
   ```

   Generate a session secret with:

   ```powershell
   python -c "import secrets; print(secrets.token_urlsafe(48))"
   ```

   The app creates and stores a random local secret in the ignored `.session_secret` file if `SESSION_SECRET` is blank. For deployments, set a persistent `SESSION_SECRET` environment variable or in `.env` instead. Keep both `.env` and `.session_secret` private.

3. Create a virtual environment and install dependencies:

   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   ```

4. Start the server:

   ```powershell
   uvicorn main:app --reload --host 127.0.0.1 --port 8000
   ```

5. Visit <http://localhost:8000/login> and sign in with the admin's Gmail address and password. If this is the first run, select **Create account** to set up the first admin username, email, and password. Public account creation closes after that first account is created.

On first startup, the CRM creates its tables and inserts sample phones and CRM records if the tables are empty. Existing tables are not dropped. The old CRM tables, if present, remain untouched.

## CRM API

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/dashboard` | Monthly shop metrics, recent sales, and pending reminders |
| `POST` | `/api/auth/login` | Sign in as the configured administrator |
| `POST` | `/api/auth/register` | Create the first admin account (one-time signup) |
| `POST` | `/api/auth/logout` | Sign out and clear the admin session |
| `GET`, `POST` | `/api/customers` | Search/list customers and add a customer |
| `PUT`, `DELETE` | `/api/customers/{id}` | Update a customer; deletion is blocked if sales exist |
| `GET`, `POST` | `/api/products` | List inventory or add a phone model |
| `PUT` | `/api/products/{id}` | Update model price, stock, or specifications |
| `GET`, `POST` | `/api/sales` | List sales or record a customer purchase and deduct stock |
| `GET`, `POST` | `/api/follow-ups` | List reminders or schedule a customer interaction |
| `PUT`, `DELETE` | `/api/follow-ups/{id}` | Update/complete or remove a reminder |

Recording a sale uses the server's price unless the manager provides an agreed selling price. The endpoint checks inventory in a database transaction and deducts the sold quantity.

## Configuration and production readiness

Keep `.env` and virtual environments out of version control. The included `.gitignore` already excludes them. Admin access uses a salted PBKDF2 password hash and a signed, HTTP-only session cookie; passwords must be non-empty but have no minimum length. Public account creation closes after the first admin account is created. The session signing secret must be at least 32 characters. Use HTTPS when exposing the app outside localhost; the session cookie is marked secure on HTTPS requests. Before using real customer data, add staff roles, backups, audit history, data-retention controls, and a migration tool. Customer phone numbers and purchase notes are personal data; avoid entering real customer information into a public demo deployment.
