# ProjectHub - Collaborative Project Management Platform

A multi-user platform where Admins, Project Managers, Team Members and Viewers manage projects, tasks, team members and comments. Permissions are enforced on the server, and concurrent task edits are protected by version checks (HTTP 409).

## Tech stack
- Frontend: React (Vite), React Router, plain CSS
- Backend: Node.js, Express
- Database: MongoDB (runs locally), Mongoose
- Auth: JWT (bcrypt-hashed passwords)

## Prerequisites
- Node.js 22+
- MongoDB running locally on port 27017
- Git

## Setup

1. Clone and enter the project
   ```
   git clone https://github.com/ishaansingh1916/project-platform.git
   cd project-platform
   ```

2. Backend
   ```
   cd server
   npm install
   ```
   Create `server/.env` by copying `server/.env.example`, and set:
   ```
   PORT=5001
   MONGO_URI=mongodb://localhost:27017/projectplatform
   JWT_SECRET=any_long_random_text
   ```

3. Seed the database (creates sample users, projects, tasks and comments; it also clears the old data first)
   ```
   npm run seed
   ```

4. Start the backend (runs on http://localhost:5001)
   ```
   npm run dev
   ```

5. Frontend (open a second terminal)
   ```
   cd client
   npm install
   ```
   Create `client/.env` by copying `client/.env.example`:
   ```
   VITE_API_URL=http://localhost:5001/api
   ```
   Start it (runs on http://localhost:5173):
   ```
   npm run dev
   ```

## Migrations
MongoDB has no SQL migrations. The schema is defined in code by the Mongoose models in `server/models`, and `npm run seed` rebuilds the data from scratch. Running the seed on an empty database is the documented way to reproduce the setup.

## Sample logins (password for all: `Password@123`)

| Role | Email |
|---|---|
| Admin | admin@test.com |
| Project Manager | manager@test.com |
| Team Member | member@test.com |
| Viewer | viewer@test.com |

## Features by role
- **Admin:** manage users (create, change role, deactivate), create and delete projects, assign project managers, see all projects.
- **Project Manager:** manage assigned projects, add and remove team members, create, update, delete and assign tasks, change task status.
- **Team Member:** see projects they belong to, edit and change the status of tasks assigned to them, add comments.
- **Viewer:** read-only access to projects and tasks.

## API overview
- `POST /api/auth/login`, `GET /api/auth/me`
- `GET/POST /api/users`, `PUT /api/users/:id`, `PATCH /api/users/:id/deactivate|activate`
- `GET/POST /api/projects`, `GET/PUT/DELETE /api/projects/:id`, `PATCH /api/projects/:id/archive`
- `POST /api/projects/:id/members`, `PATCH/DELETE /api/projects/:id/members/:userId`
- `GET/POST /api/projects/:id/tasks`, `GET/PUT/DELETE /api/tasks/:id`, `PATCH /api/tasks/:id/status`
- `GET/POST /api/tasks/:id/comments`, `DELETE /api/comments/:commentId`

Lists support pagination (`page`, `limit`) and filters (`status`, `search`, `assignee`).

## Architecture note

### Data model
- **users:** name, unique email, passwordHash, global role (admin, project_manager, team_member, viewer), isActive
- **projects:** name, description, status (active or archived), createdBy, and an embedded `members` array of `{ user, role }` (project-level role)
- **tasks:** project, title, description, status, priority, assignee, dueDate, createdBy, and `version` (used for conflict detection)
- **comments:** task, author, text

Members are embedded in the project because they are always read with it and the list is small.

### Authorization
Two layers, both enforced on the server:
1. **Global role** (`requireRole`): admin-only actions such as managing users and creating or deleting projects.
2. **Project role** (`loadProject` and `requireProjectRole`): the server finds the user's role inside the project and rejects non-members with 403. Managers and admins can manage tasks and team members. A team member can change only tasks assigned to them. Viewers are read-only. Only an admin can assign or remove a project manager. Archived projects are read-only.

`requireAuth` loads the user from the database on every request, so a deactivated user is blocked immediately. The UI hides buttons by role for usability only.

### Concurrent updates
Each task has a `version`. Updates must send the version they loaded. The server runs a single query, `findOneAndUpdate({ _id, version }, { $set, $inc: { version: 1 } })`, so the check and the update happen atomically. If the version no longer matches, the server returns **409** with the latest task, and the UI shows a warning and refreshes the form with the latest data. Nothing is silently overwritten.

### Security and data integrity
- Passwords are hashed with bcrypt, and the hash is never returned by the API.
- Inputs are validated on the server (required fields, enums, ObjectIds, assignee must be a project member).
- Search text is regex-escaped.
- Deleting a task removes its comments. Deleting a project removes its tasks and their comments.
- Secrets live in `.env`, which is git-ignored, and `.env.example` is provided.

### Possible improvements
Automated tests for permissions and conflict detection, refresh tokens or httpOnly cookies, real-time updates, and Tailwind styling.