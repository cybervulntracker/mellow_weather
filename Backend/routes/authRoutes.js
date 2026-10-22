const express = require("express");
const c = require("../controllers/authController");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

router.post("/register", c.registerUser);
router.post("/login", c.loginUser);
router.post("/two-factor", c.loginTwoFactor);
router.post("/google", c.googleLogin);
router.get("/me", requireAuth, c.getCurrentUser);
router.post("/logout", c.logoutUser);

router.post("/forgot-password", c.forgotPassword);
router.post("/reset-password", c.resetPassword);
router.post("/verify-email", c.verifyEmail);
router.post("/resend-verification", requireAuth, c.resendVerification);

module.exports = router;
