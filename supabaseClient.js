import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "Supabase URL or Service Role Key is missing. Make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your environment variables.",
  )
  // In a real app, you might want to throw an error or exit
  // For now, we'll proceed, but Supabase calls will fail.
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    // It's generally recommended to set autoRefreshToken to false for server-side operations
    // unless you have a specific need to manage refresh tokens on the server.
    // For auth actions like signUp and signInWithPassword, this is fine.
    autoRefreshToken: false,
    persistSession: false, // Do not persist sessions on the server
  },
})
