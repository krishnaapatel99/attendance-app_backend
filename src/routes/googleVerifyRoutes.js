// routes/googleVerifyRoutes.js
import express from "express";
import { verifyEmailWithGoogle } from "../controllers/googleEmailVerifyController.js";
import verifyToken from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post(
  "/verify-google-email",
  verifyToken,
  verifyEmailWithGoogle
);

export default router;
