# NexusCRM — Customer Relationship Management System

A full-stack CRM built with **FastAPI** (Python), **MySQL**, and a modern **Tailwind CSS** frontend.

---

## Project Structure

```
final crm/
├── main.py              # FastAPI application entry point
├── database.py          # SQLAlchemy async engine & session
├── models.py            # ORM models (Company, Contact, Deal, Interaction)
├── schemas.py           # Pydantic v2 schemas
├── routers/
│   ├── companies.py     # Company CRUD endpoints
│   ├── contacts.py      # Contact CRUD endpoints
│   ├── deals.py         # Deal CRUD endpoints
│   └── interactions.py  # Interaction CRUD endpoints
├── templates/
│   └── index.html       # SPA frontend (Tailwind CSS + Font Awesome)
├── static/
│   └── app.js           # Frontend logic (fetch API, drag-and-drop)
├── requirements.txt
└── .env.example
```

---

## Prerequisites

- Python 3.10+
- MySQL 8.0+
- pip

---

## Step 1 — Set Up MySQL Database

Connect to your MySQL server and run:

```sql
CREATE DATABASE crm_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

> The tables are created automatically when the app starts — no manual migrations needed.

---

## Step 2 — Configure Environment Variables

Copy the example env file and fill in your MySQL credentials:

```bash
copy .env.example .env
```

Edit `.env`:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=crm_db
```

---

## Step 3 — Install Python Dependencies

Create and activate a virtual environment (recommended):

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS/Linux
python -m venv venv
source venv/bin/activate
```

Install packages:

```bash
pip install -r requirements.txt
```

---

## Step 4 — Run the Application

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Open your browser at: **http://localhost:8000**

---

## Step 5 — Explore the API (Optional)

Interactive Swagger UI: **http://localhost:8000/docs**  
ReDoc documentation: **http://localhost:8000/redoc**

---

## API Endpoints Summary

| Method | Endpoint                         | Description                  |
|--------|----------------------------------|------------------------------|
| GET    | `/api/dashboard/stats`           | Dashboard statistics         |
| GET    | `/api/companies`                 | List all companies           |
| POST   | `/api/companies`                 | Create a company             |
| PUT    | `/api/companies/{id}`            | Update a company             |
| DELETE | `/api/companies/{id}`            | Delete a company             |
| GET    | `/api/contacts`                  | List all contacts            |
| POST   | `/api/contacts`                  | Create a contact             |
| PUT    | `/api/contacts/{id}`             | Update a contact             |
| DELETE | `/api/contacts/{id}`             | Delete a contact             |
| GET    | `/api/deals`                     | List all deals               |
| POST   | `/api/deals`                     | Create a deal                |
| PUT    | `/api/deals/{id}`                | Update deal (inc. stage)     |
| DELETE | `/api/deals/{id}`                | Delete a deal                |
| GET    | `/api/interactions`              | List all interactions        |
| POST   | `/api/interactions`              | Log an interaction           |
| PUT    | `/api/interactions/{id}`         | Update an interaction        |
| DELETE | `/api/interactions/{id}`         | Delete an interaction        |

---

## Features

- **Dashboard**: Live stats (companies, contacts, active deals, revenue) and recent activity feed
- **Companies**: Full CRUD with searchable table
- **Contacts**: Linked to companies, full CRUD
- **Deals Pipeline**: 
  - Kanban board with 5 stages: Lead → Contacted → Proposal → Closed-Won → Closed-Lost
  - **Drag-and-drop** cards between columns to update stage
  - Toggle between Kanban and Table view
- **Activity Log**: Timeline of calls, emails, meetings, and notes with type filtering
- **Modals**: Smooth animated forms for all create/edit operations
- **Toast Notifications**: Success and error feedback
- **Confirm Dialogs**: Safe delete confirmations

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `ModuleNotFoundError` | Run `pip install -r requirements.txt` in your virtual env |
| `Connection refused` | Check MySQL is running and `.env` credentials are correct |
| `Access denied` MySQL | Verify `DB_USER` and `DB_PASSWORD` in `.env` |
| Tables not created | Check the startup logs — SQLAlchemy creates them automatically |
| CORS issues | Already handled — CORS is configured for all origins |
