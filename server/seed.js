require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");
const Project = require("./models/Project");

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  await User.deleteMany({});
  await Project.deleteMany({});

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

  await Project.create([
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

  console.log("Seed done. All passwords: Password@123");
  process.exit(0);
}

seed();