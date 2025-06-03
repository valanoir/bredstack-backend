import express from "express"
import { supabase } from "../supabaseClient.js" // Using admin client
import { protectRoute } from "../middleware/authMiddleware.js"

const router = express.Router()

// Helper function to fetch user profile (can be expanded)
async function getUserProfile(userId) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single()
  if (error && error.code !== "PGRST116") {
    // PGRST116: 0 rows
    console.error("Error fetching profile:", error)
    throw new Error("Failed to fetch user profile.")
  }
  return data || null // Return null if not found, to allow for completion checks
}

// Helper function to fetch completed tasks
async function getCompletedTasks(userId) {
  const { data, error } = await supabase.from("completed_tasks").select("task_id").eq("user_id", userId)
  if (error) {
    console.error("Error fetching completed tasks:", error)
    throw new Error("Failed to fetch completed tasks.")
  }
  return data.map((task) => task.task_id)
}

router.get("/data", protectRoute, async (req, res) => {
  const userId = req.user.id

  try {
    const profile = await getUserProfile(userId)
    if (!profile) {
      // This case should ideally be handled by frontend redirecting to profile completion
      // or the backend should have a more specific response if profile is mandatory here.
      return res.status(404).json({ error: "User profile not found. Please complete your profile." })
    }

    const completedTasks = await getCompletedTasks(userId)

    let leads = []
    let applications = []
    let notifications = []
    const stats = {
      totalLeads: 0,
      totalApplications: 0,
      pendingApplications: 0,
      acceptedApplications: 0,
    }

    if (profile.role === "lead-applier") {
      // Business posting leads
      const { data: leadsData, error: leadsError } = await supabase
        .from("leads")
        .select("*")
        .eq("created_by", userId)
        .order("created_at", { ascending: false })
        .limit(10) // For dashboard overview

      if (leadsError) throw leadsError
      leads = leadsData || []
      stats.totalLeads = leads.length // Or a count query for all leads by user

      if (leads.length > 0) {
        const { data: appsData, error: appsError } = await supabase
          .from("applications")
          .select("*, leads(*), profiles!applications_applicant_id_fkey(*)")
          .in(
            "lead_id",
            leads.map((l) => l.id),
          )
          .order("created_at", { ascending: false })
          .limit(5) // For dashboard overview
        if (appsError) throw appsError
        applications = appsData || []

        // Fetch all applications for this user's leads for stats
        const { data: allAppsForUserLeads, error: allAppsError } = await supabase
          .from("applications")
          .select("id, status")
          .in(
            "lead_id",
            leads.map((l) => l.id),
          )
        if (allAppsError) throw allAppsError

        stats.totalApplications = allAppsForUserLeads?.length || 0
        stats.pendingApplications = allAppsForUserLeads?.filter((app) => app.status === "pending").length || 0
        stats.acceptedApplications = allAppsForUserLeads?.filter((app) => app.status === "accepted").length || 0

        // Notifications: new applications for their leads
        const { data: notificationsData } = await supabase
          .from("applications")
          .select("*, leads(*), profiles!applications_applicant_id_fkey(*)") // Adjust select as needed
          .in(
            "lead_id",
            leads.map((lead) => lead.id),
          )
          .order("created_at", { ascending: false })
          .limit(5)
        notifications = notificationsData || []
      }
    } else {
      // Professional finding leads
      const { data: leadsData, error: leadsError } = await supabase
        .from("leads")
        .select("*")
        .eq("status", "active") // Assuming 'active' leads are relevant
        .order("created_at", { ascending: false })
        .limit(10)
      if (leadsError) throw leadsError
      leads = leadsData || []
      stats.totalLeads = leads.length // Or a count query for all active leads

      const { data: appsData, error: appsError } = await supabase
        .from("applications")
        .select("*, leads(*)")
        .eq("applicant_id", userId)
        .order("created_at", { ascending: false })
        .limit(5)
      if (appsError) throw appsError
      applications = appsData || []

      // Fetch all applications by this user for stats
      const { data: allUserApps, error: allUserAppsError } = await supabase
        .from("applications")
        .select("id, status")
        .eq("applicant_id", userId)
      if (allUserAppsError) throw allUserAppsError

      stats.totalApplications = allUserApps?.length || 0
      stats.pendingApplications = allUserApps?.filter((app) => app.status === "pending").length || 0
      stats.acceptedApplications = allUserApps?.filter((app) => app.status === "accepted").length || 0

      // Notifications: status changes on their applications
      const { data: notificationsData } = await supabase
        .from("applications")
        .select("*, leads(*)")
        .eq("applicant_id", userId)
        .not("status", "eq", "pending") // Example: only show non-pending
        .order("updated_at", { ascending: false })
        .limit(5)
      notifications = notificationsData || []
    }

    res.json({
      profile,
      completedTasks,
      leads,
      applications,
      notifications,
      stats,
      // Credits are part of the profile object
    })
  } catch (error) {
    console.error("Error fetching dashboard data:", error)
    res.status(500).json({ error: error.message || "Failed to fetch dashboard data." })
  }
})

export default router
