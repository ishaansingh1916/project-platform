const express = require("express");
const mongoose = require("mongoose");
const Project = require("../models/Project");
const User = require("../models/User");
const { requireAuth, requireRole } = require("../middleware/auth");
const { loadProject, requireProjectRole } = require("../middleware/projectAccess");

const router = express.Router();
router.use(requireAuth);

const ROLES = ["project_manager", "team_member", "viewer"];

function findMember(project, userId) {
  for (let i = 0; i < project.members.length; i++) {
    if (project.members[i].user.toString() === userId) return project.members[i];
  }
  return null;
}

// LIST (admin sees all, others see only their projects) + search, status filter, pagination
router.get("/", async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  const filter = {};
  if (req.user.role !== "admin") filter["members.user"] = req.user._id;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) {
    const safe = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.name = { $regex: safe, $options: "i" };
  }
  const total = await Project.countDocuments(filter);
  const projects = await Project.find(filter)
    .populate("members.user", "name email role")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  res.json({ data: projects, page: page, limit: limit, total: total });
});

// CREATE (admin only) and assign a project manager
router.post("/", requireRole("admin"), async (req, res) => {
  const { name, description, managerId } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ message: "Project name is required" });
  if (!mongoose.isValidObjectId(managerId)) {
    return res.status(400).json({ message: "A valid managerId is required" });
  }
  const manager = await User.findById(managerId);
  if (!manager || !manager.isActive) {
    return res.status(400).json({ message: "Manager not found or deactivated" });
  }
  const project = await Project.create({
    name: name.trim(),
    description: description || "",
    createdBy: req.user._id,
    members: [{ user: manager._id, role: "project_manager" }],
  });
  res.status(201).json(project);
});

// READ ONE
router.get("/:id", loadProject, async (req, res) => {
  await req.project.populate("members.user", "name email role");
  res.json({ project: req.project, myRole: req.projectRole });
});

// UPDATE (admin or the project's manager)
router.put("/:id", loadProject, requireProjectRole("admin", "project_manager"), async (req, res) => {
  const { name, description } = req.body;
  if (name !== undefined) {
    if (!name.trim()) return res.status(400).json({ message: "Project name cannot be empty" });
    req.project.name = name.trim();
  }
  if (description !== undefined) req.project.description = description;
  await req.project.save();
  res.json(req.project);
});

// ARCHIVE / UNARCHIVE  body: { "archived": true }
router.patch("/:id/archive", loadProject, requireProjectRole("admin", "project_manager"), async (req, res) => {
  req.project.status = req.body.archived === false ? "active" : "archived";
  await req.project.save();
  res.json(req.project);
});

// ADD MEMBER
router.post("/:id/members", loadProject, requireProjectRole("admin", "project_manager"), async (req, res) => {
  const { userId, role } = req.body;
  if (!mongoose.isValidObjectId(userId) || !ROLES.includes(role)) {
    return res.status(400).json({ message: "Valid userId and role are required" });
  }
  if (role === "project_manager" && req.projectRole !== "admin") {
    return res.status(403).json({ message: "Only an admin can assign a project manager" });
  }
  const user = await User.findById(userId);
  if (!user || !user.isActive) return res.status(400).json({ message: "User not found or deactivated" });
  if (findMember(req.project, userId)) {
    return res.status(409).json({ message: "User is already a member" });
  }
  req.project.members.push({ user: user._id, role: role });
  await req.project.save();
  await req.project.populate("members.user", "name email role");
  res.status(201).json(req.project);
});

// CHANGE MEMBER ROLE
router.patch("/:id/members/:userId", loadProject, requireProjectRole("admin", "project_manager"), async (req, res) => {
  const { role } = req.body;
  if (!ROLES.includes(role)) return res.status(400).json({ message: "Invalid role" });
  const member = findMember(req.project, req.params.userId);
  if (!member) return res.status(404).json({ message: "Member not found" });
  if ((role === "project_manager" || member.role === "project_manager") && req.projectRole !== "admin") {
    return res.status(403).json({ message: "Only an admin can change a project manager" });
  }
  member.role = role;
  await req.project.save();
  await req.project.populate("members.user", "name email role");
  res.json(req.project);
});

// REMOVE MEMBER
router.delete("/:id/members/:userId", loadProject, requireProjectRole("admin", "project_manager"), async (req, res) => {
  const member = findMember(req.project, req.params.userId);
  if (!member) return res.status(404).json({ message: "Member not found" });
  if (member.role === "project_manager" && req.projectRole !== "admin") {
    return res.status(403).json({ message: "Only an admin can remove a project manager" });
  }
  req.project.members = req.project.members.filter(function (m) {
    return m.user.toString() !== req.params.userId;
  });
  await req.project.save();
  res.json({ message: "Member removed" });
});

module.exports = router;