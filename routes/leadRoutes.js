import express from "express"
import { supabase } from "../supabaseClient.js"
import { protectRoute } from "../middleware/authMiddleware.js"

const router = express.Router()

router.delete("/:id", protectRoute, async (req, res) => {
  const leadId = req.params.id
  const userId = req.user.id

  try {
    // Optional: Check if the user is the owner of the lead before deleting
    const { data: lead, error: fetchError } = await supabase
      .from("leads")
      .select("created_by")
      .eq("id", leadId)
      .single()

    if (fetchError || !lead) {
      return res.status(404).json({ error: "Lead not found." })
    }

    if (lead.created_by !== userId) {
      return res.status(403).json({ error: "Forbidden: You are not authorized to delete this lead." })
    }

    const { error: deleteError } = await supabase.from("leads").delete().eq("id", leadId)

    if (deleteError) {
      throw deleteError
    }

    res.status(200).json({ message: "Lead deleted successfully." })
  } catch (error) {
    console.error("Error deleting lead:", error)
    res.status(500).json({ error: error.message || "Failed to delete lead." })
  }
})

const countIsValid = (data) => {
  if (data === null || data === undefined) return false
  if (typeof data === "number" && data >= 0) return true
  if (Array.isArray(data) && data.length > 0 && typeof data[0].count === "number" && data[0].count >= 0) return true
  if (typeof data.count === "number" && data.count >= 0) return true // If RPC returns { count: N }
  return false
}

router.get("/:leadId/application-count", protectRoute, async (req, res) => {
  console.log(`[Node.js Backend /leads/:leadId/application-count] Received request for leadId: ${req.params.leadId}`)
  console.log("[Node.js Backend /leads/:leadId/application-count] Authenticated user:", req.user) // From protectRoute

  try {
    const leadId = req.params.leadId

    console.log("[Node.js Backend /leads/:leadId/application-count] Attempting RPC call 'count_lead_applications'")
    const { data: countData, error: rpcError } = await supabase.rpc("count_lead_applications", {
      lead_id_arg: leadId,
    })
    console.log(
      "[Node.js Backend /leads/:leadId/application-count] RPC call result - data:",
      countData,
      "error:",
      rpcError,
    )

    let finalCount = 0
    if (typeof countData === "number") {
      finalCount = countData
    } else if (Array.isArray(countData) && countData.length > 0 && typeof countData[0].count === "number") {
      finalCount = countData[0].count
    } else if (countData && typeof countData.count === "number") {
      // If RPC returns { count: N }
      finalCount = countData.count
    }

    if (rpcError || !countIsValid(countData)) {
      console.log(
        "[Node.js Backend /leads/:leadId/application-count] RPC failed or returned invalid data. Falling back to direct count.",
      )
      console.error("RPC error or invalid data:", rpcError, countData)

      console.log("[Node.js Backend /leads/:leadId/application-count] Attempting direct count query.")
      const { count, error: countError } = await supabase
        .from("applications")
        .select("*", { count: "exact" })
        .eq("lead_id", leadId)
      console.log(
        "[Node.js Backend /leads/:leadId/application-count] Direct count query result - count:",
        count,
        "error:",
        countError,
      )

      if (countError) {
        console.error("[Node.js Backend /leads/:leadId/application-count] Error with direct count query:", countError)
        return res.status(500).json({ error: "Failed to count applications." })
      }

      if (count !== null) {
        // from direct query
        finalCount = count
      }
    }

    console.log(
      `[Node.js Backend /leads/:leadId/application-count] Sending response: { count: ${finalCount}, maxAllowed: 6 }`,
    )
    return res.json({ count: finalCount, maxAllowed: 6 })
  } catch (error) {
    console.error("[Node.js Backend /leads/:leadId/application-count] Unhandled error in route:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
})

// Placeholder for POST /api/leads (create lead) - to be implemented later
router.post("/", protectRoute, async (req, res) => {
  // ... logic for creating a lead ...
  res.status(501).json({ message: "Create lead endpoint not yet implemented." })
})

export default router
