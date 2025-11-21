const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("./models/user");
const Note = require("./models/note");

const SECRET = "supersecretkey";

const app = express();
app.use(cors());
app.use(express.json());

// ----------------- DATABASE CONNECTION -----------------
mongoose.connect("mongodb://192.168.56.30:27017/testdb")
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error(err));


// ----------------- BASIC ROUTES -----------------
app.get("/", (req, res) => {
  res.send("Backend is running");
});

app.get("/api/test", (req, res) => {
  res.json({ message: "Hello from backend" });
});


// ----------------- HELPER: AUTH MIDDLEWARE -----------------
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "No token provided" });

  const token = header.split(" ")[1]; // "Bearer <token>"

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded; // userId + department
    next();
  } catch (err) {
    res.status(403).json({ error: "Invalid token" });
  }
}


// ----------------- AUTH ROUTES -----------------

// REGISTER
app.post("/api/register", async (req, res) => {
  try {
    const { email, password, department } = req.body;

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      password: hashed,
      department
    });

    res.json({ message: "User created", user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// LOGIN
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ error: "User not found" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ error: "Invalid password" });

  const token = jwt.sign(
    { userId: user._id, department: user.department },
    SECRET,
    { expiresIn: "2h" }
  );

  res.json({ token });
});


// ----------------- NOTES ROUTES -----------------

// CREATE A NOTE (requires login)
app.post("/api/notes", auth, async (req, res) => {
  try {
    const note = await Note.create({
      title: req.body.title,
      content: req.body.content,
      attachments: req.body.attachments || [],
      department: req.user.department,
      createdAt: new Date()
    });

    res.json(note);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE NOTE
app.put("/api/notes/:id", auth, async (req, res) => {
  try {
    const note = await Note.findOneAndUpdate(
      {
        _id: req.params.id,
        department: req.user.department // security: only same department
      },
      {
        title: req.body.title,
        content: req.body.content,
        attachments: req.body.attachments
      },
      { new: true }
    );

    if (!note) return res.status(404).json({ error: "Note not found" });

    res.json(note);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE NOTE
app.delete("/api/notes/:id", auth, async (req, res) => {
  try {
    const deleted = await Note.findOneAndDelete({
      _id: req.params.id,
      department: req.user.department
    });

    if (!deleted) return res.status(404).json({ error: "Note not found" });

    res.json({ message: "Note deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// GET NOTES FOR LOGGED-IN USER'S DEPARTMENT
app.get("/api/notes", auth, async (req, res) => {
  try {
    const notes = await Note.find({ department: req.user.department });
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ----------------- START SERVER -----------------
const PORT = 3000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`Server running on port ${PORT}`)
);
