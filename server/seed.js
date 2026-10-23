require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");
const Project = require("./models/Project");
const Task = require("./models/Task");
const Comment = require("./models/Comment");

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  await Comment.deleteMany({});
  await Task.deleteMany({});
  await Project.deleteMany({});
  await User.deleteMany({});

  const passwordHash = await bcrypt.hash("Password@123", 10);
  const users = await User.create([
    { name: "Admin User", email: "admin@test.com", passwordHash, role: "admin" },
    { name: "Priya Manager", email: "manager@test.com", passwordHash, role: "project_manager" },
    { name: "Tarun Member", email: "member@test.com", passwordHash, role: "team_member" },
    { name: "Vikas Viewer", email: "viewer@test.com", passwordHash, role: "viewer" },
  ]);
  const admin = users[0];
  const manager = users[1];
  const member = users[2];
  const viewer = users[3];

  const projects = await Project.create([
    {
      name: "Website Redesign",
      description: "Redesign the company website",
      createdBy: admin._id,
      members: [
        { user: manager._id, role: "project_manager" },
        { user: member._id, role: "team_member" },
        { user: viewer._id, role: "viewer" },
      ],
    },
    {
      name: "Mobile App",
      description: "Build the first version of the mobile app",
      createdBy: admin._id,
      members: [{ user: manager._id, role: "project_manager" }],
    },
  ]);
  const web = projects[0];
  const app = projects[1];

  const tasks = await Task.create([
    { project: web._id, title: "Design homepage", description: "Create the new homepage layout", status: "todo", priority: "high", assignee: member._id, createdBy: manager._id },
    { project: web._id, title: "Write copy for About page", status: "in_progress", priority: "medium", assignee: manager._id, createdBy: manager._id },
    { project: web._id, title: "Fix navigation bug", status: "review", priority: "high", assignee: member._id, createdBy: manager._id },
    { project: web._id, title: "Plan launch checklist", status: "todo", priority: "low", assignee: null, createdBy: manager._id },
    { project: app._id, title: "Create wireframes", status: "todo", priority: "medium", assignee: manager._id, createdBy: manager._id },
  ]);

  await Comment.create([
    { task: tasks[0]._id, author: manager._id, text: "Please follow the new brand colours." },
    { task: tasks[0]._id, author: member._id, text: "Started working on it." },
  ]);

  console.log("Seed done. All passwords: Password@123");
  process.exit(0);
}

seed();