import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";

const STATUSES = ["todo", "in_progress", "review", "done"];

export default function TaskDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [task, setTask] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [myRole, setMyRole] = useState("");
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState({ title: "", description: "", priority: "medium", assignee: "", dueDate: "" });
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState("");
  const [error, setError] = useState("");

  const isManager = myRole === "admin" || myRole === "project_manager";

  function fillForm(t) {
    setForm({
      title: t.title,
      description: t.description || "",
      priority: t.priority,
      assignee: t.assignee ? t.assignee._id : "",
      dueDate: t.dueDate ? t.dueDate.slice(0, 10) : "",
    });
  }

  async function load() {
    try {
      const res = await api("/tasks/" + id);
      setTask(res.task);
      setCanEdit(res.canEdit);
      setMyRole(res.myRole);
      fillForm(res.task);
      const proj = await api("/projects/" + res.task.project);
      setMembers(proj.project.members);
      const list = await api("/tasks/" + id + "/comments");
      setComments(list);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  // 409 means someone else changed the task first: show the latest version
  function handleError(err) {
    if (err.status === 409 && err.data && err.data.latestTask) {
      setTask(err.data.latestTask);
      fillForm(err.data.latestTask);
      setConflict(
        "This task was changed by someone else while you were editing. The latest version is now shown. Please review it and apply your change again."
      );
      setMessage("");
    } else {
      setError(err.message);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setError("");
    setConflict("");
    setMessage("");
    try {
      const updated = await api("/tasks/" + id, "PUT", { ...form, version: task.version });
      setTask(updated);
      fillForm(updated);
      setMessage("Task saved");
    } catch (err) {
      handleError(err);
    }
  }

  async function handleStatus(newStatus) {
    setError("");
    setConflict("");
    setMessage("");
    try {
      const updated = await api("/tasks/" + id + "/status", "PATCH", { status: newStatus, version: task.version });
      setTask(updated);
      setMessage("Status updated");
    } catch (err) {
      handleError(err);
    }
  }

  async function handleDeleteTask() {
    if (!window.confirm("Delete this task and its comments?")) return;
    try {
      await api("/tasks/" + id, "DELETE");
      window.location.href = "/projects/" + task.project;
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddComment(e) {
    e.preventDefault();
    setError("");
    if (!text.trim()) return;
    try {
      const c = await api("/tasks/" + id + "/comments", "POST", { text: text });
      setComments([...comments, c]);
      setText("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteComment(commentId) {
    setError("");
    try {
      await api("/comments/" + commentId, "DELETE");
      setComments(comments.filter((c) => c._id !== commentId));
    } catch (err) {
      setError(err.message);
    }
  }

  if (!task) {
    return <p>{error ? <span className="error">{error}</span> : "Loading..."}</p>;
  }

  return (
    <div>
      <p><Link to={"/projects/" + task.project}>← Back to project</Link></p>
      <h2>{task.title}</h2>
      <p className="muted">Version {task.version} | Your role: {myRole}</p>

      {conflict && <div className="warn">{conflict}</div>}
      {message && <p style={{ color: "green" }}>{message}</p>}
      {error && <p className="error">{error}</p>}

      <div className="box">
        <label>Status: </label>
        <select value={task.status} disabled={!canEdit} onChange={(e) => handleStatus(e.target.value)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {!canEdit && <span className="muted"> (read only for you)</span>}
      </div>

      <form onSubmit={handleSave} className="box">
        <div className="row">
          <input placeholder="Title" value={form.title} disabled={!canEdit} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <select value={form.priority} disabled={!canEdit} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <select value={form.assignee} disabled={!canEdit || !isManager} onChange={(e) => setForm({ ...form, assignee: e.target.value })}>
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.user._id} value={m.user._id}>{m.user.name}</option>
            ))}
          </select>
          <input type="date" value={form.dueDate} disabled={!canEdit} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
        </div>
        <textarea
          placeholder="Description"
          rows="3"
          style={{ width: "100%", boxSizing: "border-box" }}
          value={form.description}
          disabled={!canEdit}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        {canEdit && (
          <div className="row">
            <button type="submit">Save changes</button>
            {isManager && <button type="button" onClick={handleDeleteTask}>Delete task</button>}
          </div>
        )}
      </form>

      <h3>Comments ({comments.length})</h3>
      {comments.length === 0 && <p className="muted">No comments yet.</p>}
      {comments.map((c) => (
        <div className="box" key={c._id}>
          <b>{c.author.name}</b> <span className="muted">{new Date(c.createdAt).toLocaleString()}</span>
          <p>{c.text}</p>
          {(c.author._id === user.id || isManager) && (
            <button onClick={() => handleDeleteComment(c._id)}>Delete</button>
          )}
        </div>
      ))}

      {myRole !== "viewer" && (
        <form onSubmit={handleAddComment} className="row">
          <input style={{ flex: 1 }} placeholder="Write a comment..." value={text} onChange={(e) => setText(e.target.value)} />
          <button type="submit">Add comment</button>
        </form>
      )}
    </div>
  );
}