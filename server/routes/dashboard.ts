import { Router } from "express";
import { asyncHandler } from "../lib/errors";
import { getDashboardData } from "../services/dashboard";
import { requestUserId } from "../lib/requestUser";

export const dashboardRouter = Router();

dashboardRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await getDashboardData(requestUserId(req)));
  })
);
