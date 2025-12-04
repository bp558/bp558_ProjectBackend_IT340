const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { exec } = require("child_process");

const User = require("./models/user");
const Note = require("./models/note");

const SECRET = "supersecretkey";

const app = express();
app.use(cors());
app.use(express.json());

// logging logic

function sendLog(message) {
  const timestamp = new Date().toISOString(); 
  const logLine = `${timestamp} - ${message}`;

  exec(`echo "${logLine}" | nc 192.168.56.40 5000`, (err) => {
    if (err) console.error("Logging error:", err);
  });
}

// ----------------- DATABASE CONNECTION -----------------
mongoose.connect("mongodb://192.168.56.30:27017/testdb")
  .then(() => {
    console.log("Connected to MongoDB");
    sendLog("Backend connected to MongoDB"); // logging
  })
  .catch(err => {
    console.error(err);
    sendLog(`MongoDB connection ERROR: ${err.message}`);
  });


// ----------------- BASIC ROUTES -----------------
app.get("/", (req, res) => {
  res.send("Backend is running");
});

app.get("/api/test", (req, res) => {
  res.json({ message: "Hello from backend" });
});


// AUTH MIDDLEWARE
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) {
    sendLog("Unauthorized request: No token provided");
    return res.status(401).json({ error: "No token provided" });
  }

  const token = header.split(" ")[1];
  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    sendLog("Unauthorized request: Invalid token");
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

    sendLog(`User registered: ${email}, Department: ${department}`);

    res.json({ message: "User created", user });
  } catch (err) {
    sendLog(`ERROR registering user: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});


// LOGIN
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    sendLog(`FAILED login: User not found (${email})`);
    return res.status(400).json({ error: "User not found" });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    sendLog(`FAILED login: Wrong password for (${email})`);
    return res.status(400).json({ error: "Invalid password" });
  }

  const token = jwt.sign(
    { userId: user._id, department: user.department },
    SECRET,
    { expiresIn: "2h" }
  );

  sendLog(`User login successful: ${email}`);

  res.json({ token });
});


// note routes

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

    sendLog(
      `Note created: ${note._id}, By User: ${req.user.userId}, Dept: ${req.user.department}`
    );

    res.json(note);
  } catch (err) {
    sendLog(`ERROR creating note: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// UPDATE NOTE
app.put("/api/notes/:id", auth, async (req, res) => {
  try {
    const note = await Note.findOneAndUpdate(
      {
        _id: req.params.id,
        department: req.user.department
      },
      {
        title: req.body.title,
        content: req.body.content,
        attachments: req.body.attachments
      },
      { new: true }
    );

    if (!note) {
      sendLog(`Failed note update: Note not found (${req.params.id})`);
      return res.status(404).json({ error: "Note not found" });
    }

    sendLog(`Note updated: ${req.params.id}, By User: ${req.user.userId}`);

    res.json(note);
  } catch (err) {
    sendLog(`ERROR updating note: ${err.message}`);
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

    if (!deleted) {
      sendLog(`Failed note delete: Note not found (${req.params.id})`);
      return res.status(404).json({ error: "Note not found" });
    }

    sendLog(`Note deleted: ${req.params.id}, By User: ${req.user.userId}`);

    res.json({ message: "Note deleted" });
  } catch (err) {
    sendLog(`ERROR deleting note: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});


// GET NOTES FOR LOGGED-IN USER'S DEPARTMENT
app.get("/api/notes", auth, async (req, res) => {
  try {
    const notes = await Note.find({ department: req.user.department });

    sendLog(
      `Notes fetched for Dept: ${req.user.department} by User: ${req.user.userId}`
    );

    res.json(notes);
  } catch (err) {
    sendLog(`ERROR fetching notes: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});


// ----------------- START SERVER -----------------
const PORT = 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  sendLog("Backend server started");
});
