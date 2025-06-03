import express from "express"
import { supabase } from "../supabaseClient.js" // This is your ADMIN Supabase client
import { protectRoute } from "../middleware/authMiddleware.js"

const router = express.Router()

// Endpoint to get profile details for a specific user ID
// This is called by the Next.js frontend's /api/direct-profile proxy
router.post("/get-profile-details", protectRoute, async (req, res) => {
  // protectRoute ensures req.user is populated and the calling user is authenticated
  const callingUserId = req.user.id // ID of the user making the request (from Next.js frontend)
  const { targetUserId } = req.body // ID of the profile we want to fetch

  console.log(
    `Node.js Backend (/api/users/get-profile-details): Called by user ${callingUserId} to fetch profile for ${targetUserId}`,
  )

  if (!targetUserId) {
    return res.status(400).json({ error: "Target User ID (targetUserId) is required." })
  }

  try {
    // Option 1: Use your existing RPC function if it's designed for admin use
    // Ensure 'get_direct_profile_data' uses the SERVICE_ROLE_KEY implicitly or is SECURITY DEFINER
    const { data: rpcData, error: rpcError } = await supabase.rpc("get_direct_profile_data", {
      p_user_id: targetUserId,
    })

    if (rpcError) {
      console.error(`Node.js Backend: RPC 'get_direct_profile_data' error for ${targetUserId}:`, rpcError)
      // Fallback to direct query
    } else if (rpcData && (Array.isArray(rpcData) ? rpcData.length > 0 : rpcData)) {
      const profileFromRpc = Array.isArray(rpcData) ? rpcData[0] : rpcData
      if (profileFromRpc && profileFromRpc.id) {
        console.log(
          `Node.js Backend: Profile for ${targetUserId} found via RPC by calling user ${callingUserId}.`,
          profileFromRpc,
        )
        return res.json({ profile: profileFromRpc })
      }
    }

    // Option 2: Direct query to the profiles table using the admin client
    console.log(
      `Node.js Backend: RPC failed or no data for ${targetUserId}. Attempting direct query to 'profiles' table.`,
    )
    const { data: directProfileData, error: directProfileError } = await supabase
      .from("profiles")
      .select(
        `
        id, email, first_name, last_name, username, avatar_url, phone_number, 
        company, website, bio, role, created_at, updated_at
      `,
      ) // Select all necessary fields
      .eq("id", targetUserId)
      .maybeSingle() // Use maybeSingle to get one record or null

    if (directProfileError) {
      console.error(`Node.js Backend: Direct query to 'profiles' error for ${targetUserId}:`, directProfileError)
      // Fallback to auth.users
    } else if (directProfileData) {
      console.log(
        `Node.js Backend: Profile for ${targetUserId} found via direct query by calling user ${callingUserId}.`,
        directProfileData,
      )
      return res.json({ profile: directProfileData })
    }

    // Option 3: Fallback to auth.users (if profile entry might be missing)
    console.log(
      `Node.js Backend: Direct profile query failed for ${targetUserId}. Attempting to fetch from 'auth.users'.`,
    )
    // Note: supabase (admin client) can call auth.admin functions
    const { data: authUserResponse, error: authUserError } = await supabase.auth.admin.getUserById(targetUserId)

    if (authUserError) {
      console.error(`Node.js Backend: Fetch from 'auth.users' error for ${targetUserId}:`, authUserError)
      return res.status(404).json({ error: "Profile not found after multiple attempts." })
    }

    if (authUserResponse && authUserResponse.user) {
      const user = authUserResponse.user
      const profileFromAuth = {
        id: user.id,
        email: user.email,
        first_name: user.user_metadata?.first_name || user.email?.split("@")[0] || "User",
        last_name: user.user_metadata?.last_name || "",
        username: user.user_metadata?.username || user.email?.split("@")[0],
        avatar_url: user.user_metadata?.avatar_url || "",
        phone_number: user.phone || null,
        company: user.user_metadata?.company || null,
        website: user.user_metadata?.website || null,
        bio: user.user_metadata?.bio || null,
        role: user.role || "user",
        created_at: user.created_at,
        updated_at: user.updated_at,
      }
      console.log(
        `Node.js Backend: Constructed profile for ${targetUserId} from 'auth.users' by calling user ${callingUserId}.`,
        profileFromAuth,
      )
      return res.json({ profile: profileFromAuth })
    }

    console.warn(`Node.js Backend: No profile or auth user found for targetUserId: ${targetUserId}.`)
    return res.status(404).json({ error: "Profile not found." })
  } catch (error) {
    console.error("Node.js Backend: Error in /get-profile-details route:", error)
    res.status(500).json({ error: "Internal server error while fetching profile." })
  }
})

export default router
