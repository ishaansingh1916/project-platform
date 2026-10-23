const express = require("express");
const mongoose = require("mongoose");
const Task = require("../models/Task");
const Comment = require("../models/Comment");
const Project = require("../models/Project");
const { requireAuth } = require("../middleware/auth");
const { getProjectRole, loadProject, requireProjectRole } = require("../middleware/projectAccess");

const router = express.Router();

const STATUSES = ["todo", "in_progress", "review", "done"];
const PRIORITIES = ["low", "medium", "high"];

function isMember(project, userId) {
  for (let i = 0; i < project.members.length; i++) {
    if (project.members[i].user.toString() === String(userId)) return true;
  }
  return false;
}

// Archived projects are read-only
function blockIfArchived(req, res, next) {
  if (req.project.status === "archived") {
    return res.status(403).json({ message: "Project is archived (read only)" });
  }
  next();
}

// Loads the task from :id, then its project, and checks the user belongs to it
async function loadTask(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid task id" });
  }
  const task = await Task.findById(req.params.id);
  if (!task) return res.status(404).json({ message: "Task not found" });
  const project = await Project.findById(task.project);
  if (!project) return res.status(404).json({ message: "Project not found" });
  const role = getProjectRole(project, req.user);
  if (!role) return res.status(403).json({ message: "You are not a member of this project" });
  req.task = task;
  req.project = project;
  req.projectRole = role;
  next();
}

// Managers and admins can edit any task. A team member only their own assigned task.
function canEditTask(req) {
  if (req.projectRole === "admin" || req.projectRole === "project_manager") return true;
  if (
    req.projectRole === "team_member" &&
    req.task.assignee &&
    req.task.assignee.toString() === req.user._id.toString()
  ) {
    return true;
  }
  return false;
}

// ---------- TASKS IN A PROJECT ----------

// LIST with filters: ?status= &assignee=me|<id> &search= &page= &limit=
router.get("/projects/:id/tasks", requireAuth, loadProject, async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const filter = { project: req.project._id };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.assignee === "me") filter.assignee = req.user._id;
  else if (mongoose.isValidObjectId(req.query.assignee)) filter.assignee = req.query.assignee;
  if (req.query.search) {
    const safe = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.title = { $regex: safe, $options: "i" };
  }
  const total = await Task.countDocuments(filter);
  const tasks = await Task.find(filter)
    .populate("assignee", "name email")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  res.json({ data: tasks, page: page, limit: limit, total: total });
});

// CREATE (admin or project manager)
router.post(
  "/projects/:id/tasks",
  requireAuth,
  loadProject,
  requireProjectRole("admin", "project_manager"),
  blockIfArchived,
  async (req, res) => {
    const { title, description, status, priority, assignee, dueDate } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ message: "Task title is required" });
    if (status && !STATUSES.includes(status)) return res.status(400).json({ message: "Invalid status" });
    if (priority && !PRIORITIES.includes(priority)) return res.status(400).json({ message: "Invalid priority" });
    if (assignee && (!mongoose.isValidObjectId(assignee) || !isMember(req.project, assignee))) {
      return res.status(400).json({ message: "Assignee must be a member of this project" });
    }
    if (dueDate && isNaN(new Date(dueDate))) return res.status(400).json({ message: "Invalid due date" });

    const task = await Task.create({
      project: req.project._id,
      title: title.trim(),
      description: description || "",
      status: status || "todo",
      priority: priority || "medium",
      assignee: assignee || null,
      dueDate: dueDate || null,
      createdBy: req.user._id,
    });
    res.status(201).json(task);
  }
);

// ---------- ONE TASK ----------

router.get("/tasks/:id", requireAuth, loadTask, async (req, res) => {
  await req.task.populate("assignee", "name email");
  await req.task.populate("createdBy", "name email");
  res.json({ task: req.task, myRole: req.projectRole, canEdit: canEditTask(req) && req.project.status === "active" });
});

// Shared update with the version check (this is the concurrency control)
async function applyUpdate(req, res, changes) {
  const version = Number(req.body.version);
  if (!version) {
    return res.status(400).json({ message: "The task version is required" });
  }
  // Only updates the task if the version still matches, and bumps the version, in ONE step
  const updated = await Task.findOneAndUpdate(
    { _id: req.task._id, version: version },
    { $set: changes, $inc: { version: 1 } },
    { new: true, runValidators: true }
  );
  if (!updated) {
    const latest = await Task.findById(req.task._id).populate("assignee", "name email");
    return res.status(409).json({
      message: "This task was changed by someone else. Review the latest version and try again.",
      latestTask: latest,
    });
  }
  await updated.populate("assignee", "name email");
  res.json(updated);
}

// UPDATE fields (needs body.version)
router.put("/tasks/:id", requireAuth, loadTask, blockIfArchived, async (req, res) => {
  if (!canEditTask(req)) {
    return res.status(403).json({ message: "You can only edit tasks assigned to you" });
  }
  const { title, description, status, priority, assignee, dueDate } = req.body;
  const changes = {};

  if (title !== undefined) {
    if (!title.trim()) return res.status(400).json({ message: "Task title cannot be empty" });
    changes.title = title.trim();
  }
  if (description !== undefined) changes.description = description;
  if (status !== undefined) {
    if (!STATUSES.includes(status)) return res.status(400).json({ message: "Invalid status" });
    changes.status = status;
  }
  if (priority !== undefined) {
    if (!PRIORITIES.includes(priority)) return res.status(400).json({ message: "Invalid priority" });
    changes.priority = priority;
  }
  if (dueDate !== undefined) {
    if (dueDate && isNaN(new Date(dueDate))) return res.status(400).json({ message: "Invalid due date" });
    changes.dueDate = dueDate || null;
  }
  if (assignee !== undefined) {
    const current = req.task.assignee ? req.task.assignee.toString() : "";
    const wanted = assignee ? String(assignee) : "";
    if (wanted !== current) {
      if (req.projectRole === "team_member") {
        return res.status(403).json({ message: "Only a manager can assign tasks" });
      }
      if (wanted && (!mongoose.isValidObjectId(wanted) || !isMember(req.project, wanted))) {
        return res.status(400).json({ message: "Assignee must be a member of this project" });
      }
      changes.assignee = wanted || null;
    }
  }
  await applyUpdate(req, res, changes);
});

// CHANGE STATUS only (needs body.version)
router.patch("/tasks/:id/status", requireAuth, loadTask, blockIfArchived, async (req, res) => {
  if (!canEditTask(req)) {
    return res.status(403).json({ message: "You can only change the status of tasks assigned to you" });
  }
  if (!STATUSES.includes(req.body.status)) {
    return res.status(400).json({ message: "Invalid status" });
  }
  await applyUpdate(req, res, { status: req.body.status });
});

// DELETE (admin or project manager) also removes the task's comments
router.delete(
  "/tasks/:id",
  requireAuth,
  loadTask,
  requireProjectRole("admin", "project_manager"),
  blockIfArchived,
  async (req, res) => {
    await Comment.deleteMany({ task: req.task._id });
    await req.task.deleteOne();
    res.json({ message: "Task deleted" });
  }
);

// ---------- COMMENTS ----------

router.get("/tasks/:id/comments", requireAuth, loadTask, async (req, res) => {
  const comments = await Comment.find({ task: req.task._id })
    .populate("author", "name role")
    .sort({ createdAt: 1 })
    .limit(200);
  res.json(comments);
});

// Viewers cannot comment
router.post(
  "/tasks/:id/comments",
  requireAuth,
  loadTask,
  requireProjectRole("admin", "project_manager", "team_member"),
  blockIfArchived,
  async (req, res) => {
    const text = req.body.text;
    if (!text || !text.trim()) return res.status(400).json({ message: "Comment text is required" });
    if (text.length > 1000) return res.status(400).json({ message: "Comment is too long (max 1000)" });
    const comment = await Comment.create({ task: req.task._id, author: req.user._id, text: text });
    await comment.populate("author", "name role");
    res.status(201).json(comment);
  }
);

// DELETE: the author, or a manager/admin of that project
router.delete("/comments/:commentId", requireAuth, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.commentId)) {
    return res.status(400).json({ message: "Invalid comment id" });
  }
  const comment = await Comment.findById(req.params.commentId);
  if (!comment) return res.status(404).json({ message: "Comment not found" });
  const task = await Task.findById(comment.task);
  const project = task ? await Project.findById(task.project) : null;
  if (!project) return res.status(404).json({ message: "Project not found" });

  const role = getProjectRole(project, req.user);
  if (!role) return res.status(403).json({ message: "You are not a member of this project" });
  if (project.status === "archived") {
    return res.status(403).json({ message: "Project is archived (read only)" });
  }
  const isAuthor = comment.author.toString() === req.user._id.toString();
  const isManager = role === "admin" || role === "project_manager";
  if (!isAuthor && !isManager) {
    return res.status(403).json({ message: "You can only delete your own comments" });
  }
  await comment.deleteOne();
  res.json({ message: "Comment deleted" });
});

module.exports = router;