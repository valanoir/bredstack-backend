import { supabase } from "../supabaseClient.js"

export const protectRoute = async (req, res, next) => {
  const authHeader = req.headers.authorization
  console.log("Backend authMiddleware - Received authHeader:", authHeader) // DEBUG LINE

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: No token provided or malformed header." })
  }

  const token = authHeader.split(" ")[1]
  console.log("Backend authMiddleware - Extracted token:", token) // DEBUG LINE

  if (!token) {
    return res.status(401).json({ error: "Unauthorized: Token could not be extracted." })
  }

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)

    if (error) {
      console.error("Supabase token validation error:", error)
      return res.status(401).json({ error: `Unauthorized: ${error.message}` })
    }

    if (!user) {
      return res.status(401).json({ error: "Unauthorized: Invalid token or user not found." })
    }

    req.user = user // Attach user object to the request
    next()
  } catch (error) {
    console.error("Auth middleware unexpected error:", error)
    res.status(500).json({ error: "Internal server error during authentication." })
  }
}
