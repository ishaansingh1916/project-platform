require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  await User.deleteMany({});

  const passwordHash = await bcrypt.hash("Password@123", 10);
  await User.create([
    { name: "Admin User", email: "admin@test.com", passwordHash, role: "admin" },
    { name: "Priya Manager", email: "manager@test.com", passwordHash, role: "project_manager" },
    { name: "Tarun Member", email: "member@test.com", passwordHash, role: "team_member" },
    { name: "Vikas Viewer", email: "viewer@test.com", passwordHash, role: "viewer" },
  ]);

  console.log("Seed done. All passwords: Password@123");
  process.exit(0);
}

seed();