const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return res.status(401).json({ message: "Wrong email or password" });
  if (!user.isActive) return res.status(403).json({ message: "Account is deactivated" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: "Wrong email or password" });

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "8h" });
  res.json({
    token: token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
});

router.get("/me", requireAuth, (req, res) => {
  const u = req.user;
  res.json({ id: u._id, name: u.name, email: u.email, role: u.role });
});

module.exports = router;