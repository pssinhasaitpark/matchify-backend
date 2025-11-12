// app/services/cronJobs.js
import cron from "node-cron";
import { resetDailyUsage } from "./planService.js";

export const setupCronJobs = () => {
  // Reset daily usage at midnight
  cron.schedule("0 0 * * *", async () => {
    await resetDailyUsage();
    console.log("Daily usage reset for all users.");
  });
};
