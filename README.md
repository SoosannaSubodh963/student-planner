# Student Task Planner 🎓

A responsive, feature-rich web application built for students and academic administrators to organize tasks, assignments, deadlines, study sessions, and announcements — with data persistence in browser LocalStorage.

---

## 🚀 Features

- **Student Portal**:
  - Task management with priorities, status tracking, and overdue alerts.
  - Interactive monthly calendar with deadline highlights.
  - Study planner and timetable scheduler.
  - Assignment tracker with submission progress.
  - Quick to-do list and subject notes.
  - Productivity insights and completion statistics.
  - Notifications and administrator announcements.

- **Admin Console**:
  - Student directory and account management.
  - Task and assignment oversight across departments.
  - Announcement publisher with audience targeting (all, department, semester).
  - Activity logs and reporting with CSV export.

---

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6)
- **Icons & Fonts**: Font Awesome 6.5, Google Fonts (Inter)
- **Data Layer**: Browser LocalStorage
- **Containerization**: Docker & Nginx Alpine

---

## 🐳 Running with Docker

### Using Docker CLI
```bash
# Build Docker image
docker build -t student-planner .

# Run container
docker run -d -p 8080:80 --name student-planner student-planner
```
Visit **http://localhost:8080** in your browser.

### Using Docker Compose
```bash
docker compose up -d
```
Visit **http://localhost:8080** in your browser.

---

## 💻 Running Locally (Without Docker)

### Option 1: Python HTTP Server
```bash
python -m http.server 8000
```
Open **http://localhost:8000** in your browser.

### Option 2: Directly in Browser
Double-click `index.html` to open it in Chrome, Edge, or Firefox.

---

## 🔑 Demo Login Credentials

The application automatically seeds demo data on initial launch:

| Role | Username / Identifier | Password | How to Access |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin` *(or `admin@taskplanner.edu`)* | `Admin@123` | Click **Admin** on navigation bar or go to `login.html?role=admin` |
| **Student** | `aisha@student.edu` *(or `CS2021001`)* | `Student@123` | Default student login on `login.html` |

*(You can also create a new student account at `register.html`)*
