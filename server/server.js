require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/projects", require("./routes/projects"));
app.use("/api", require("./routes/tasks"));

// Catches any unexpected error so the server returns JSON instead of crashing
app.use((err, req, res, next) => {
  console.log("Error:", err.message);
  if (err.name === "CastError") return res.status(400).json({ message: "Invalid id" });
  if (err.code === 11000) return res.status(409).json({ message: "Already exists" });
  res.status(500).json({ message: "Server error" });
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(process.env.PORT, () => {
      console.log("Server running on port " + process.env.PORT);
    });
  })
  .catch((err) => console.log("DB error:", err.message));