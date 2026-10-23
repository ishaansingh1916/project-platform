const mongoose = require("mongoose");
const Project = require("../models/Project");

// Finds the user's role inside a project (admin counts as "admin")
function getProjectRole(project, user) {
  if (user.role === "admin") return "admin";
  for (let i = 0; i < project.members.length; i++) {
    if (project.members[i].user.toString() === user._id.toString()) {
      return project.members[i].role;
    }
  }
  return null;
}

// Loads the project from :id and checks that the user belongs to it
async function loadProject(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid project id" });
  }
  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json({ message: "Project not found" });

  const role = getProjectRole(project, req.user);
  if (!role) {
    return res.status(403).json({ message: "You are not a member of this project" });
  }
  req.project = project;
  req.projectRole = role;
  next();
}

// Allows only the given project roles
function requireProjectRole(...roles) {
  return function (req, res, next) {
    if (!roles.includes(req.projectRole)) {
      return res.status(403).json({ message: "You do not have permission for this action" });
    }
    next();
  };
}

module.exports = { getProjectRole, loadProject, requireProjectRole };