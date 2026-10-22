const crypto = require("crypto");
const argon2 = require("argon2");
const User = require("../models/Users");
const ActivityLog = require("../models/ActivityLog");
const SiteSettings = require("../models/SiteSettings");
const logActivity = require("../utils/logActivity");
const track = require("../utils/track");
const { startSession, endSession } = require("../utils/sessionTracker");
const { revokeSessions } = require("../utils/sessions");
const { createToken, consumeToken } = require("../utils/tokens");
const { sendMail, clientUrl } = require("../utils/mailer");
const { decrypt, sha256 } = require("../utils/crypto");
const { verifyTotp } = require("../utils/totp");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FAILED = 8; // wrong passwords or 2FA codes, per account, per 10 minutes
const TEN_MINUTES = 10 * 60 * 1000;

const recentCount = (userId, action, sinceMs) =>
  ActivityLog.countDocuments({ actorId: userId, action, occurredAt: { $gte: new Date(Date.now() - sinceMs) } });

/* ---------------- emails ---------------- */

async function sendVerificationEmail(user) {
  const token = await createToken(user._id, "verify", 24 * 60);
  await sendMail({
    to: user.email,
    subject: "Verify your email for MellowWeather",
    text: `Hi ${user.username},\n\nConfirm your email address:\n${clientUrl()}/verify-email?token=${token}\n\nThis link works for 24 hours.`,
  });
}

/* ---------------- finishing a login ---------------- */

// New session id, session record, activity log, response. Used by every way of signing in.
function finishLogin(req, res, user, method = "password") {
  return new Promise((resolve) => {
    req.session.regenerate(async (regenError) => {
      if (regenError) {
        console.error("SESSION REGENERATE ERROR:", regenError);
        res.status(500).json({ message: "Could not start your session" });
        return resolve();
      }
      req.session.userId = String(user._id);

      try {
        user.lastLoginAt = new Date();
        user.loginCount += 1;
        await user.save();
        await startSession(req, user);
      } catch (error) {
        console.error("SESSION TRACK ERROR:", error.message);
      }

      req.session.save(async (saveError) => {
        if (saveError) {
          console.error("SESSION SAVE ERROR:", saveError);
          res.status(500).json({ message: "Login succeeded, but the session could not be saved" });
          return resolve();
        }
        const how = { password: "Logged in", google: "Logged in with Google", "two-factor": "Logged in (two-factor)" }[method];
        await track(req, { actor: user, action: "auth.login", description: how });
        res.status(200).json({ message: "Login successful", user: user.toPublic() });
        resolve();
      });
    });
  });
}

// After the password (or Google) check: either finish, or wait for the 2FA code.
async function continueLogin(req, res, user, method) {
  if (!user.twoFactorEnabled) return finishLogin(req, res, user, method);

  return new Promise((resolve) => {
    req.session.regenerate((error) => {
      if (error) {
        res.status(500).json({ message: "Could not start your session" });
        return resolve();
      }
      req.session.pending2fa = { userId: String(user._id), at: Date.now() };
      req.session.save(() => {
        res.status(200).json({ twoFactorRequired: true });
        resolve();
      });
    });
  });
}

/* ---------------- register / login ---------------- */

const registerUser = async (req, res) => {
  try {
    const settings = await SiteSettings.findOne({ key: "main" }).lean();
    if (settings && settings.allowRegistrations === false) {
      return res.status(403).json({ message: "New registrations are currently closed." });
    }

    const username = String(req.body.username || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!username) return res.status(400).json({ message: "Please enter your name" });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ message: "Please enter a valid email address" });
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });
    if (await User.findOne({ email })) return res.status(409).json({ message: "An account with this email already exists" });

    const newUser = await User.create({
      username, email, password: await argon2.hash(password), preferredUnit: settings?.defaultUnit || "C",
    });

    await track(req, { actor: newUser, action: "auth.register", description: "Created an account", targetId: newUser._id, targetLabel: newUser.email });
    await sendVerificationEmail(newUser);

    return res.status(201).json({ message: "Registration successful", user: newUser.toPublic() });
  } catch (error) {
    console.error("REGISTER ERROR:", error);
    return res.status(500).json({ message: "Failed to register user" });
  }
};

const loginUser = async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (!email || !password) return res.status(400).json({ message: "Email and password are required" });

    const user = await User.findOne({ email });
    // Same message for "no such user" and "wrong password" so the form can't be used to find emails.
    if (!user) return res.status(401).json({ message: "Invalid email or password" });

    if ((await recentCount(user._id, "auth.login_failed", TEN_MINUTES)) >= MAX_FAILED) {
      return res.status(429).json({ message: "Too many failed attempts. Please try again in a few minutes." });
    }

    if (!(await argon2.verify(user.password, password))) {
      await track(req, { actor: user, action: "auth.login_failed", description: "Failed login attempt — wrong password", outcome: "failure", count: false });
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (user.status === "suspended") {
      await track(req, { actor: user, action: "auth.login_blocked", description: "Login blocked — account is suspended", outcome: "failure", count: false });
      return res.status(403).json({ message: "Your account has been suspended. Please contact an administrator." });
    }

    return await continueLogin(req, res, user, "password");
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    return res.status(500).json({ message: "Failed to login" });
  }
};

// Second step for accounts with an authenticator app (or a backup code)
const loginTwoFactor = async (req, res) => {
  try {
    const pending = req.session?.pending2fa;
    if (!pending || Date.now() - pending.at > 5 * 60 * 1000) {
      return res.status(401).json({ message: "Your sign-in timed out. Please start again." });
    }

    const user = await User.findById(pending.userId).select("+twoFactorSecret +twoFactorBackup");
    if (!user || user.status === "suspended" || !user.twoFactorEnabled) {
      return res.status(401).json({ message: "Please sign in again." });
    }
    if ((await recentCount(user._id, "auth.2fa_failed", TEN_MINUTES)) >= MAX_FAILED) {
      return res.status(429).json({ message: "Too many wrong codes. Please try again in a few minutes." });
    }

    const code = String(req.body.code || "").trim();
    let accepted = false;

    if (/^\d{3}\s?\d{3}$/.test(code)) {
      const step = verifyTotp(decrypt(user.twoFactorSecret), code);
      if (step && step > user.twoFactorLastStep) { // a code can only be used once
        user.twoFactorLastStep = step;
        accepted = true;
      }
    } else {
      const hash = sha256(code.replace(/[\s-]/g, "").toLowerCase());
      const index = user.twoFactorBackup.indexOf(hash);
      if (index >= 0) {
        user.twoFactorBackup.splice(index, 1); // backup codes are single-use
        accepted = true;
      }
    }

    if (!accepted) {
      await track(req, { actor: user, action: "auth.2fa_failed", description: "Wrong two-factor code", outcome: "failure", count: false });
      return res.status(401).json({ message: "That code isn't right. Try again." });
    }
    return await finishLogin(req, res, user, "two-factor");
  } catch (error) {
    console.error("2FA LOGIN ERROR:", error);
    return res.status(500).json({ message: "Failed to verify the code" });
  }
};

// "Sign in with Google": the browser sends Google's signed ID token, we verify it with Google's keys.
const googleLogin = async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return res.status(503).json({ message: "Google sign-in is not set up on this server." });

  try {
    const { OAuth2Client } = require("google-auth-library");
    let profile;
    try {
      const ticket = await new OAuth2Client(clientId).verifyIdToken({ idToken: String(req.body.credential || ""), audience: clientId });
      profile = ticket.getPayload();
    } catch {
      return res.status(401).json({ message: "Google sign-in could not be verified." });
    }
    if (!profile?.email || !profile.email_verified) {
      return res.status(401).json({ message: "Your Google email address is not verified." });
    }

    const email = profile.email.toLowerCase();
    let user = await User.findOne({ email });

    if (!user) {
      const settings = await SiteSettings.findOne({ key: "main" }).lean();
      if (settings && settings.allowRegistrations === false) {
        return res.status(403).json({ message: "New registrations are currently closed." });
      }
      user = await User.create({
        username: String(profile.name || email.split("@")[0]).slice(0, 60),
        email,
        password: await argon2.hash(crypto.randomBytes(32).toString("hex")), // nobody knows it; they can set one via "forgot password"
        authProvider: "google",
        passwordSet: false,
        emailVerified: true,
        preferredUnit: settings?.defaultUnit || "C",
      });
      await track(req, { actor: user, action: "auth.register", description: "Created an account with Google", targetId: user._id, targetLabel: email });
    } else if (!user.emailVerified) {
      user.emailVerified = true; // Google has proven they own this address
      await user.save();
    }

    if (user.status === "suspended") {
      await track(req, { actor: user, action: "auth.login_blocked", description: "Login blocked — account is suspended", outcome: "failure", count: false });
      return res.status(403).json({ message: "Your account has been suspended. Please contact an administrator." });
    }
    return await continueLogin(req, res, user, "google");
  } catch (error) {
    console.error("GOOGLE LOGIN ERROR:", error);
    return res.status(500).json({ message: "Failed to sign in with Google" });
  }
};

const getCurrentUser = async (req, res) => res.status(200).json(req.user.toPublic());

const logoutUser = async (req, res) => {
  const userId = req.session?.userId;
  const trackId = req.session?.trackId;
  try {
    if (userId) {
      const user = await User.findById(userId).select("role");
      await endSession(trackId, "logout");
      if (user) await logActivity({ actorId: user._id, actorRole: user.role, action: "auth.logout", description: "Logged out" });
    }
  } catch (error) {
    console.error("LOGOUT TRACK ERROR:", error.message);
  }
  req.session.destroy((error) => {
    if (error) return res.status(500).json({ message: "Logout failed" });
    res.clearCookie("connect.sid");
    return res.status(200).json({ message: "Logged out successfully" });
  });
};

/* ---------------- forgot / reset password, verify email ---------------- */

// Always answers the same way, so it can't be used to discover which emails have accounts.
const forgotPassword = async (req, res) => {
  const generic = { message: "If an account exists for that email, a reset link has been sent." };
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const user = EMAIL_RE.test(email) ? await User.findOne({ email }) : null;

    if (user && user.status === "active" && (await recentCount(user._id, "auth.password_reset_requested", 15 * 60 * 1000)) < 5) {
      const token = await createToken(user._id, "reset", 60);
      await sendMail({
        to: user.email,
        subject: "Reset your MellowWeather password",
        text: `Hi ${user.username},\n\nChoose a new password here:\n${clientUrl()}/reset-password?token=${token}\n\nThis link works for 1 hour. If you didn't ask for it, you can ignore this email.`,
      });
      await track(req, { actor: user, action: "auth.password_reset_requested", description: "Asked for a password reset link", count: false });
    }
    return res.status(200).json(generic);
  } catch (error) {
    console.error("FORGOT PASSWORD ERROR:", error);
    return res.status(200).json(generic);
  }
};

const resetPassword = async (req, res) => {
  try {
    const password = String(req.body.password || "");
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });

    const userId = await consumeToken(req.body.token, "reset");
    const user = userId && (await User.findById(userId));
    if (!user) return res.status(400).json({ message: "This reset link is invalid or has expired." });

    user.password = await argon2.hash(password);
    user.passwordSet = true;
    user.emailVerified = true; // they just proved they own the inbox
    await user.save();

    await revokeSessions(req.sessionStore, user._id); // everyone signed in elsewhere is signed out
    await track(req, { actor: user, action: "auth.password_reset", description: "Reset password using an email link" });
    return res.status(200).json({ message: "Password updated. You can sign in now." });
  } catch (error) {
    console.error("RESET PASSWORD ERROR:", error);
    return res.status(500).json({ message: "Failed to reset password" });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const userId = await consumeToken(req.body.token, "verify");
    const user = userId && (await User.findById(userId));
    if (!user) return res.status(400).json({ message: "This verification link is invalid or has expired." });

    user.emailVerified = true;
    await user.save();
    await track(req, { actor: user, action: "auth.email_verified", description: "Verified email address" });
    return res.status(200).json({ message: "Email verified. Thank you!" });
  } catch (error) {
    console.error("VERIFY EMAIL ERROR:", error);
    return res.status(500).json({ message: "Failed to verify email" });
  }
};

const resendVerification = async (req, res) => {
  try {
    if (req.user.emailVerified) return res.status(400).json({ message: "Your email is already verified." });
    if ((await recentCount(req.user._id, "auth.verification_sent", 60 * 60 * 1000)) >= 3) {
      return res.status(429).json({ message: "Please wait a while before asking for another email." });
    }
    await sendVerificationEmail(req.user);
    await track(req, { action: "auth.verification_sent", description: "Asked for a new verification email", count: false });
    return res.status(200).json({ message: "Verification email sent." });
  } catch (error) {
    console.error("RESEND VERIFICATION ERROR:", error);
    return res.status(500).json({ message: "Failed to send the email" });
  }
};

module.exports = {
  registerUser, loginUser, loginTwoFactor, googleLogin, getCurrentUser, logoutUser,
  forgotPassword, resetPassword, verifyEmail, resendVerification,
};
