import { Plan } from "../models/plan.js";
import { handleResponse } from "../utils/helper.js";

const upsertPlan = async (req, res) => {
  try {
    const { name, ...rest } = req.body;
    if (!name) return handleResponse(res, 400, "Plan name is required.");

    const plan = await Plan.findOneAndUpdate({ name }, rest, {
      new: true,
      upsert: true,
    });

    return handleResponse(res, 200, `${name} plan saved successfully.`, plan.toObject());
  } catch (error) {
    console.error("Error saving plan:", error);
    return handleResponse(res, 500, "Something went wrong while saving plan.");
  }
};

const getAllPlans = async (req, res) => {
  try {
    const plans = await Plan.find({});
    return handleResponse(res, 200, "Plans fetched successfully.", plans);
  } catch (error) {
    console.error("Error fetching plans:", error);
    return handleResponse(res, 500, "Something went wrong while fetching plans.");
  }
};

const getPlanByName = async (req, res) => {
  try {
    const { name } = req.params;
    const plan = await Plan.findOne({ name: name.toUpperCase() });
    if (!plan) return handleResponse(res, 404, "Plan not found.");
    return handleResponse(res, 200, "Plan fetched successfully.", plan);
  } catch (error) {
    console.error("Error fetching plan:", error);
    return handleResponse(res, 500, "Something went wrong while fetching plan.");
  }
};

export const plan = {
    upsertPlan,
    getAllPlans,
    getPlanByName
}