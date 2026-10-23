import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";

export default function ProjectDetail({ initialTab }) {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [myRole, setMyRole] = useState("");
  const [tab, setTab] = useState(initialTab || "tasks");
  const [error, setError] = useState("");
  const [editForm, setEditForm] = useState({ name: "", description: "" });

  const [tasks, setTasks] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [taskForm, setTaskForm] = useState({ title: "", description: "", priority: "medium", assignee: "" });

  const [directory, setDirectory] = useState([]);
  const [newMember, setNewMember] = useState({ userId: "", role: "team_member" });

  const canManage = myRole === "admin" || myRole === "project_manager";
  const archived = project && project.status === "archived";

  async function loadProject() {
    try {
      const res = await api("/projects/" + id);
      setProject(res.project);
      setMyRole(res.myRole);
      setEditForm({ name: res.project.name, description: res.project.description });
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadTasks() {
    try {
      const query = "?limit=100&status=" + statusFilter + "&search=" + encodeURIComponent(search);
      const res = await api("/projects/" + id + "/tasks" + query);
      setTasks(res.data);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadProject();
  }, [id]);

  useEffect(() => {
    loadTasks();
  }, [id, statusFilter, search]);

  useEffect(() => {
    if (canManage) {
      api("/users/directory").then(setDirectory).catch(() => {});
    }
  }, [myRole]);

  async function handleSaveProject(e) {
    e.preventDefault();
    setError("");
    try {
      await api("/projects/" + id, "PUT", editForm);
      loadProject();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleArchive() {
    setError("");
    try {
      await api("/projects/" + id + "/archive", "PATCH", { archived: !archived });
      loadProject();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreateTask(e) {
    e.preventDefault();
    setError("");
    if (!taskForm.title.trim()) {
      setError("Task title is required");
      return;
    }
    try {
      await api("/projects/" + id + "/tasks", "POST", taskForm);
      setTaskForm({ title: "", description: "", priority: "medium", assignee: "" });
      loadTasks();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddMember(e) {
    e.preventDefault();
    setError("");
    if (!newMember.userId) {
      setError("Select a user to add");
      return;
    }
    try {
      await api("/projects/" + id + "/members", "POST", newMember);
      setNewMember({ userId: "", role: "team_member" });
      loadProject();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleChangeRole(userId, role) {
    setError("");
    try {
      await api("/projects/" + id + "/members/" + userId, "PATCH", { role: role });
      loadProject();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemoveMember(userId) {
    if (!window.confirm("Remove this member from the project?")) return;
    setError("");
    try {
      await api("/projects/" + id + "/members/" + userId, "DELETE");
      loadProject();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!project) {
    return <p>{error ? <span className="error">{error}</span> : "Loading..."}</p>;
  }

  const availableUsers = directory.filter(function (u) {
    return !project.members.some(function (m) {
      return m.user._id === u._id;
    });
  });

  return (
    <div>
      <p><Link to="/projects">← Back to projects</Link></p>
      <h2>
        {project.name} {archived && <span className="muted">(archived)</span>}
      </h2>
      <p className="muted">{project.description}</p>
      <p>Your role in this project: <b>{myRole}</b></p>
      {error && <p className="error">{error}</p>}

      {canManage && (
        <form onSubmit={handleSaveProject} className="row box">
          <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          <input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
          <button type="submit">Save project</button>
          <button type="button" onClick={handleArchive}>{archived ? "Unarchive" : "Archive"}</button>
        </form>
      )}

      <div className="row">
        <button onClick={() => setTab("tasks")} style={{ fontWeight: tab === "tasks" ? "bold" : "normal" }}>Tasks</button>
        <button onClick={() => setTab("team")} style={{ fontWeight: tab === "team" ? "bold" : "normal" }}>
          Team ({project.members.length})
        </button>
      </div>

      {tab === "tasks" && (
        <div>
          {canManage && !archived && (
            <form onSubmit={handleCreateTask} className="row box">
              <input placeholder="Task title" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} />
              <input placeholder="Description" value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} />
              <select value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <select value={taskForm.assignee} onChange={(e) => setTaskForm({ ...taskForm, assignee: e.target.value })}>
                <option value="">Unassigned</option>
                {project.members.map((m) => (
                  <option key={m.user._id} value={m.user._id}>{m.user.name}</option>
                ))}
              </select>
              <button type="submit">Add task</button>
            </form>
          )}

          <div className="row">
            <input placeholder="Search tasks..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              <option value="todo">To do</option>
              <option value="in_progress">In progress</option>
              <option value="review">Review</option>
              <option value="done">Done</option>
            </select>
          </div>

          {tasks.length === 0 && <p className="muted">No tasks found.</p>}
          <table>
            <thead>
              <tr><th>Title</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Due</th></tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t._id}>
                  <td><Link to={"/tasks/" + t._id}>{t.title}</Link></td>
                  <td>{t.status}</td>
                  <td>{t.priority}</td>
                  <td>{t.assignee ? t.assignee.name : "-"}</td>
                  <td>{t.dueDate ? t.dueDate.slice(0, 10) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "team" && (
        <div>
          {canManage && (
            <form onSubmit={handleAddMember} className="row box">
              <select value={newMember.userId} onChange={(e) => setNewMember({ ...newMember, userId: e.target.value })}>
                <option value="">Select user</option>
                {availableUsers.map((u) => (
                  <option key={u._id} value={u._id}>{u.name} ({u.role})</option>
                ))}
              </select>
              <select value={newMember.role} onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}>
                <option value="team_member">Team member</option>
                <option value="viewer">Viewer</option>
                {myRole === "admin" && <option value="project_manager">Project manager</option>}
              </select>
              <button type="submit">Add member</button>
            </form>
          )}

          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Project role</th><th></th></tr>
            </thead>
            <tbody>
              {project.members.map((m) => (
                <tr key={m.user._id}>
                  <td>{m.user.name}</td>
                  <td>{m.user.email}</td>
                  <td>
                    {canManage ? (
                      <select value={m.role} onChange={(e) => handleChangeRole(m.user._id, e.target.value)}>
                        <option value="project_manager">project_manager</option>
                        <option value="team_member">team_member</option>
                        <option value="viewer">viewer</option>
                      </select>
                    ) : (
                      m.role
                    )}
                  </td>
                  <td>
                    {canManage && <button onClick={() => handleRemoveMember(m.user._id)}>Remove</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}