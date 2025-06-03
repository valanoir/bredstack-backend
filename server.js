import express from "express"
import cors from "cors"
import dotenv from "dotenv"
// New dashboard related routes
import dashboardRoutes from "./routes/dashboardRoutes.js"
import leadRoutes from "./routes/leadRoutes.js"
import taskRoutes from "./routes/taskRoutes.js"
import userRoutes from "./routes/userRoutes.js" // Add this import

dotenv.config()

const app = express()
const port = process.env.PORT || 3001

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000", // Configure allowed origin
    credentials: true,
  }),
)
app.use(express.json())

// --- Auth Routes (Login, Signup) ---
// It's good practice to move these to their own file too.
// For now, assuming they are in authRoutes.js or still in server.js
// If still in server.js, ensure they are defined before general API routes.
// Example: app.use("/api/auth", authRoutes);
// For this example, I'll assume you'll create backend/routes/authRoutes.js
// and move the existing /api/auth/signup and /api/auth/login there.
// If not, define them here before the next app.use lines.
// I'll create a placeholder authRoutes.js for structure.

import originalAuthRoutes from "./routes/authRoutes.js" // This will contain your existing login/signup
app.use("/api/auth", originalAuthRoutes)

// --- API Routes ---
app.use("/api/dashboard", dashboardRoutes)
app.use("/api/leads", leadRoutes)
app.use("/api/tasks", taskRoutes)
app.use("/api/users", userRoutes) // Add this line to mount the new user routes

// Original Signup Endpoint (Example - should be moved to authRoutes.js)
// app.post("/api/auth/signup", async (req, res) => { ... });
// Original Login Endpoint (Example - should be moved to authRoutes.js)
// app.post("/api/auth/login", async (req, res) => { ... });
// For this refactor, ensure your existing /api/auth/signup and /api/auth/login
// are either moved to backend/routes/authRoutes.js and imported/used,
// or defined in this server.js file *before* the new app.use(...) lines for dashboard, leads, tasks.

app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`)
})
