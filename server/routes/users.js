const express = require("express");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../models/User");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

const ROLES = ["admin", "project_manager", "team_member", "viewer"];

// Short list of active users, so managers can add them to teams
router.get("/directory", requireRole("admin", "project_manager"), async (req, res) => {
  const users = await User.find({ isActive: true }).select("name email role");
  res.json(users);
});

// LIST all users (admin)
router.get("/", requireRole("admin"), async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  const total = await User.countDocuments(filter);
  const users = await User.find(filter)
    .select("-passwordHash")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  res.json({ data: users, page: page, limit: limit, total: total });
});

// CREATE (admin)
router.post("/", requireRole("admin"), async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || password.length < 6) {
    return res.status(400).json({ message: "Name, email and a password of 6+ characters are required" });
  }
  if (!ROLES.includes(role)) return res.status(400).json({ message: "Invalid role" });
  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) return res.status(409).json({ message: "Email already in use" });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash, role });
  res.status(201).json({ id: user._id, name: user.name, email: user.email, role: user.role });
});

// UPDATE (admin)
router.put("/:id", requireRole("admin"), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid id" });
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  const { name, role } = req.body;
  if (name) user.name = name;
  if (role) {
    if (!ROLES.includes(role)) return res.status(400).json({ message: "Invalid role" });
    user.role = role;
  }
  await user.save();
  res.json({ id: user._id, name: user.name, email: user.email, role: user.role, isActive: user.isActive });
});

// DEACTIVATE / ACTIVATE (admin)
router.patch("/:id/deactivate", requireRole("admin"), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid id" });
  if (req.params.id === req.user._id.toString()) {
    return res.status(400).json({ message: "You cannot deactivate yourself" });
  }
  const user = await User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true }).select("-passwordHash");
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json(user);
});

router.patch("/:id/activate", requireRole("admin"), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid id" });
  const user = await User.findByIdAndUpdate(req.params.id, { isActive: true }, { new: true }).select("-passwordHash");
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json(user);
});

module.exports = router;