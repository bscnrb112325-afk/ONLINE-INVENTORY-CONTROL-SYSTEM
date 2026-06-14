import { Router } from "express";
import { getSubmittedBids, approveBid, rejectBid } from "../controllers/approvalController";

const router = Router();

router.get("/bids", getSubmittedBids);
router.put("/bids/:bidId/approve", approveBid);
router.put("/bids/:bidId/reject", rejectBid);

export default router;
