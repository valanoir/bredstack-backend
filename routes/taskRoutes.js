import express from "express"
import { supabase } from "../supabaseClient.js"
import { protectRoute } from "../middleware/authMiddleware.js"

const router = express.Router()

// Define credit tasks server-side for validation and credit amounts
const creditTasksDefinition = [
  {
    id: "profile",
    credits: 5,
    validate: (profile) =>
      profile &&
      profile.first_name &&
      profile.last_name &&
      profile.username &&
      profile.phone_number &&
      profile.bio &&
      profile.company &&
      profile.position,
  },
  { id: "bio", credits: 3, validate: (profile) => profile && profile.bio && profile.bio.length >= 20 },
  {
    id: "apply",
    credits: 2,
    validate: async (userId) => {
      const { count, error } = await supabase
        .from("applications")
        .select("id", { count: "exact" })
        .eq("applicant_id", userId)
        .limit(1)
      if (error) {
        console.error(error)
        return false
      }
      return count > 0
    },
  },
  { id: "company", credits: 3, validate: (profile) => profile && profile.company && profile.position },
  { id: "address", credits: 2, validate: (profile) => profile && profile.address && profile.address.length > 5 },
]

router.post("/claim-credits", protectRoute, async (req, res) => {
  const { taskId } = req.body
  const userId = req.user.id

  if (!taskId) {
    return res.status(400).json({ error: "Task ID is required." })
  }

  try {
    const taskDefinition = creditTasksDefinition.find((t) => t.id === taskId)
    if (!taskDefinition) {
      return res.status(404).json({ error: "Task definition not found." })
    }

    // Check if already claimed
    const { data: existingClaim, error: claimCheckError } = await supabase
      .from("completed_tasks")
      .select("id")
      .eq("user_id", userId)
      .eq("task_id", taskId)
      .maybeSingle() // Use maybeSingle to handle 0 or 1 row

    if (claimCheckError) throw claimCheckError
    if (existingClaim) {
      return res.status(400).json({ error: "Credits for this task already claimed." })
    }

    // Fetch user profile for validation
    const { data: profile, error: profileError } = await supabase.from("profiles").select("*").eq("id", userId).single()
    if (profileError || !profile) {
      return res.status(404).json({ error: "User profile not found for validation." })
    }

    // Validate task completion
    let isCompleted = false
    if (taskDefinition.id === "apply") {
      isCompleted = await taskDefinition.validate(userId)
    } else {
      isCompleted = taskDefinition.validate(profile)
    }

    if (!isCompleted) {
      return res.status(400).json({ error: "Task not yet completed or validation failed." })
    }

    // Add credits to profile
    const newCredits = (profile.credits || 0) + taskDefinition.credits
    const { error: updateProfileError } = await supabase
      .from("profiles")
      .update({ credits: newCredits })
      .eq("id", userId)
    if (updateProfileError) throw updateProfileError

    // Record completed task
    const { error: insertTaskError } = await supabase
      .from("completed_tasks")
      .insert({ user_id: userId, task_id: taskId, completed_at: new Date().toISOString() })
    if (insertTaskError) throw insertTaskError

    res
      .status(200)
      .json({ message: `Successfully claimed ${taskDefinition.credits} credits!`, newCreditBalance: newCredits })
  } catch (error) {
    console.error("Error claiming credits:", error)
    res.status(500).json({ error: error.message || "Failed to claim credits." })
  }
})

export default router
