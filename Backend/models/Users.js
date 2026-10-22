const mongoose = require("mongoose");

// Allowed values for the preference fields (also used to validate PATCH /users/me)
const PREF_OPTIONS = {
  preferredUnit: ["C", "F"],
  windUnit: ["kmh", "mph", "ms"],
  pressureUnit: ["hpa", "inhg"],
  precipUnit: ["mm", "in"],
  distanceUnit: ["km", "mi"],
  clock: ["12h", "24h"],
  theme: ["system", "light", "dark"],
  language: ["en", "hi"],
};

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, trim: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    status: { type: String, enum: ["active", "suspended"], default: "active" },

    // How the account was created, and whether the person ever chose a password
    authProvider: { type: String, enum: ["local", "google"], default: "local" },
    passwordSet: { type: Boolean, default: true },
    emailVerified: { type: Boolean, default: false },

    // Two-factor sign-in (authenticator app). Secrets are encrypted and hidden from normal queries.
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, select: false },
    twoFactorPending: { type: String, select: false },
    twoFactorBackup: { type: [String], select: false },
    twoFactorLastStep: { type: Number, default: 0 },

    // Profile
    bio: { type: String, default: "", maxlength: 240 },

    // Preferences
    preferredUnit: { type: String, enum: PREF_OPTIONS.preferredUnit, default: "C" },
    windUnit: { type: String, enum: PREF_OPTIONS.windUnit, default: "kmh" },
    pressureUnit: { type: String, enum: PREF_OPTIONS.pressureUnit, default: "hpa" },
    precipUnit: { type: String, enum: PREF_OPTIONS.precipUnit, default: "mm" },
    distanceUnit: { type: String, enum: PREF_OPTIONS.distanceUnit, default: "km" },
    clock: { type: String, enum: PREF_OPTIONS.clock, default: "12h" },
    theme: { type: String, enum: PREF_OPTIONS.theme, default: "system" },
    language: { type: String, enum: PREF_OPTIONS.language, default: "en" },

    // Email / in-app notifications (sent for the pinned home city)
    notifyDailyDigest: { type: Boolean, default: false },
    notifyDigestHour: { type: Number, min: 0, max: 23, default: 7 },
    notifyRainAlerts: { type: Boolean, default: false },
    lastDigestOn: { type: String, default: "" },

    // Profile photo lives in MongoDB; `select: false` keeps the bytes out of normal queries.
    avatar: {
      data: { type: Buffer, select: false },
      contentType: { type: String, select: false },
    },
    avatarVersion: { type: Number, default: 0 },

    lastLoginAt: { type: Date, default: null },
    loginCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Safe object to send to the browser (never includes password, secrets or avatar bytes)
userSchema.methods.toPublic = function () {
  return {
    _id: this._id,
    username: this.username,
    email: this.email,
    role: this.role,
    status: this.status,
    authProvider: this.authProvider,
    passwordSet: this.passwordSet,
    emailVerified: this.emailVerified,
    twoFactorEnabled: this.twoFactorEnabled,
    bio: this.bio || "",
    preferredUnit: this.preferredUnit,
    windUnit: this.windUnit,
    pressureUnit: this.pressureUnit,
    precipUnit: this.precipUnit,
    distanceUnit: this.distanceUnit,
    clock: this.clock,
    theme: this.theme,
    language: this.language,
    notifyDailyDigest: this.notifyDailyDigest,
    notifyDigestHour: this.notifyDigestHour,
    notifyRainAlerts: this.notifyRainAlerts,
    avatarUrl: this.avatarVersion ? `/api/users/${this._id}/avatar?v=${this.avatarVersion}` : null,
    lastLoginAt: this.lastLoginAt,
    loginCount: this.loginCount,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model("User", userSchema);
module.exports.PREF_OPTIONS = PREF_OPTIONS;
