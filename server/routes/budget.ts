import { Router } from "express";
import { asyncHandler } from "../lib/errors";
import { getBudgetSummary } from "../services/budget";
import { requestUserId } from "../lib/requestUser";

export const budgetRouter = Router();

budgetRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await getBudgetSummary(requestUserId(req)));
  })
);
