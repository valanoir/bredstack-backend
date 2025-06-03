import express from "express"
import { createClient } from "@supabase/supabase-js"

const router = express.Router()

const SUPABASE_URL_FROM_ENV = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY_FROM_ENV = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL_FROM_ENV || !SUPABASE_SERVICE_KEY_FROM_ENV) {
  console.error("FATAL ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in backend environment variables.")
}

const supabaseAdmin =
  SUPABASE_URL_FROM_ENV && SUPABASE_SERVICE_KEY_FROM_ENV
    ? createClient(SUPABASE_URL_FROM_ENV, SUPABASE_SERVICE_KEY_FROM_ENV)
    : null

router.post("/signup", async (req, res) => {
  if (!supabaseAdmin) {
    console.error(
      "[Backend Signup] Supabase admin client is not initialized. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.",
    )
    return res
      .status(500)
      .json({ success: false, error: "Server configuration error: Supabase client not initialized." })
  }

  const { email, password, firstName, lastName, username, role } = req.body

  if (!email || !password || !firstName || !lastName || !username || !role) {
    return res.status(400).json({ success: false, error: "Missing required fields for signup." })
  }
  if (password.length < 8) {
    return res.status(400).json({ success: false, error: "Password must be at least 8 characters long." })
  }

  // Validate role against allowed values
  const allowedRoles = ["lead-finder", "lead-applier"]
  if (!allowedRoles.includes(role)) {
    return res
      .status(400)
      .json({ success: false, error: `Invalid role specified. Allowed roles are: ${allowedRoles.join(", ")}.` })
  }

  try {
    console.log("[Backend Signup] Attempting auth.signUp for email:", email)
    const { data: authData, error: authError } = await supabaseAdmin.auth.signUp({
      email,
      password,
      options: {
        data: {
          // This data is stored in auth.users.raw_user_meta_data
          first_name: firstName,
          last_name: lastName,
          username: username,
          role: role, // This will be used by the trigger
        },
      },
    })

    if (authError) {
      console.error("[Backend Signup] Supabase auth.signUp error:", authError)
      return res.status(400).json({ success: false, error: authError.message || "Authentication signup failed." })
    }

    if (!authData.user) {
      console.error("[Backend Signup] Supabase auth.signUp successful, but authData.user is null.")
      // This case should ideally not happen if authError is null, but good to keep.
      return res
        .status(500)
        .json({ success: false, error: "User creation failed: User object not returned after signup." })
    }

    const userId = authData.user.id
    console.log(
      `[Backend Signup] User created in auth.users with ID: ${userId}. Profile creation handled by DB trigger.`,
    )

    // The DB trigger 'on_auth_user_created' will handle inserting into 'public.profiles'.
    // We assume the trigger will succeed. If it fails, the error will be a database error
    // that might not be directly caught here unless the signUp itself fails due to the trigger failing.

    const responseMessage = authData.session
      ? "Account created successfully! You are logged in."
      : "Account created successfully! Please check your email to confirm your account."

    // We don't have 'profileData' from this backend route anymore,
    // as the trigger handles it. The client might need to fetch the profile separately if needed immediately.
    res.status(201).json({
      success: true,
      message: responseMessage,
      user: authData.user,
      session: authData.session,
      // profile: null, // Or omit if client doesn't expect it from signup when trigger handles it
    })
  } catch (error) {
    // Catch any other unexpected errors in the try block
    console.error("[Backend Signup] Generic signup error:", error)
    // If a generic error occurs, we don't know for sure if the auth user was created or if the trigger ran.
    // Supabase auth.signUp itself might have failed due to the trigger failing.
    res.status(500).json({ success: false, error: error.message || "An unexpected error occurred during signup." })
  }
})

// --- Login Endpoint --- (Remains the same)
router.post("/login", async (req, res) => {
  if (!supabaseAdmin) {
    console.error(
      "[Backend Login] Supabase admin client is not initialized. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.",
    )
    return res
      .status(500)
      .json({ success: false, error: "Server configuration error: Supabase client not initialized." })
  }

  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ success: false, error: "Email and password are required." })
  }

  try {
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error("[Backend Login] Supabase signIn error:", error)
      return res.status(401).json({ success: false, error: error.message })
    }

    if (!data.session || !data.user) {
      return res.status(401).json({ success: false, error: "Login failed. No session or user data returned." })
    }

    res.status(200).json({ success: true, session: data.session, user: data.user })
  } catch (error) {
    console.error("[Backend Login] Login process error:", error)
    res.status(500).json({ success: false, error: error.message || "An unexpected error occurred during login." })
  }
})

export default router
