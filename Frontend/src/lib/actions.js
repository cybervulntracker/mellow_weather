import {
  LogIn, LogOut, UserPlus, ShieldAlert, KeyRound, Search, MapPin, Trash2, Eraser, Star, StarOff,
  UserCog, Camera, ImageOff, Thermometer, ShieldCheck, UserX, UserCheck, UserMinus, Settings, Activity,
  SearchX, Ban, MailCheck, MailQuestion, ShieldOff, Smartphone, Download, ArrowLeftRight, Luggage, Pencil, ArrowUpDown, BellRing, BellOff, SlidersHorizontal,
} from "lucide-react";

// Every action string the backend writes, with a human label, an icon and a tone.
const ACTIONS = {
  "auth.register": { label: "Signed up", icon: UserPlus, tone: "accent", group: "Account" },
  "auth.login": { label: "Signed in", icon: LogIn, tone: "neutral", group: "Account" },
  "auth.logout": { label: "Signed out", icon: LogOut, tone: "neutral", group: "Account" },
  "auth.login_failed": { label: "Failed sign-in", icon: ShieldAlert, tone: "danger", group: "Account" },
  "auth.login_blocked": { label: "Sign-in blocked", icon: Ban, tone: "danger", group: "Account" },
  "auth.password_changed": { label: "Password changed", icon: KeyRound, tone: "warning", group: "Account" },
  "auth.password_change_failed": { label: "Password change failed", icon: ShieldAlert, tone: "danger", group: "Account" },

  "auth.2fa_failed": { label: "Wrong 2FA code", icon: ShieldAlert, tone: "danger", group: "Account" },
  "auth.password_reset_requested": { label: "Reset link requested", icon: MailQuestion, tone: "neutral", group: "Account" },
  "auth.password_reset": { label: "Password reset", icon: KeyRound, tone: "warning", group: "Account" },
  "auth.email_verified": { label: "Email verified", icon: MailCheck, tone: "success", group: "Account" },
  "auth.verification_sent": { label: "Verification email", icon: MailQuestion, tone: "neutral", group: "Account" },
  "account.2fa_enabled": { label: "2FA turned on", icon: ShieldCheck, tone: "success", group: "Account" },
  "account.2fa_disabled": { label: "2FA turned off", icon: ShieldOff, tone: "warning", group: "Account" },
  "account.device_revoked": { label: "Device signed out", icon: Smartphone, tone: "warning", group: "Account" },
  "account.devices_revoked": { label: "Other devices signed out", icon: Smartphone, tone: "warning", group: "Account" },
  "account.data_exported": { label: "Data downloaded", icon: Download, tone: "neutral", group: "Account" },
  "account.self_deleted": { label: "Account deleted", icon: UserMinus, tone: "danger", group: "Account" },

  "weather.search": { label: "Searched", icon: Search, tone: "accent", group: "Weather" },
  "weather.search_failed": { label: "Search – no match", icon: SearchX, tone: "warning", group: "Weather" },
  "weather.view": { label: "Viewed place", icon: MapPin, tone: "accent", group: "Weather" },
  "weather.history_deleted": { label: "Deleted a search", icon: Trash2, tone: "warning", group: "Weather" },
  "weather.history_cleared": { label: "Cleared history", icon: Eraser, tone: "warning", group: "Weather" },

  "weather.compare": { label: "Compared places", icon: ArrowLeftRight, tone: "accent", group: "Weather" },
  "weather.trip": { label: "Planned a trip", icon: Luggage, tone: "accent", group: "Weather" },

  "favorite.updated": { label: "Edited favourite", icon: Pencil, tone: "neutral", group: "Favourites" },
  "favorite.reordered": { label: "Reordered favourites", icon: ArrowUpDown, tone: "neutral", group: "Favourites" },
  "alert.rule_created": { label: "Created alert rule", icon: BellRing, tone: "success", group: "Alerts" },
  "alert.rule_deleted": { label: "Deleted alert rule", icon: BellOff, tone: "warning", group: "Alerts" },
  "profile.preferences": { label: "Changed preferences", icon: SlidersHorizontal, tone: "neutral", group: "Profile" },

  "favorite.added": { label: "Added favourite", icon: Star, tone: "success", group: "Favourites" },
  "favorite.removed": { label: "Removed favourite", icon: StarOff, tone: "warning", group: "Favourites" },

  "profile.updated": { label: "Updated profile", icon: UserCog, tone: "neutral", group: "Profile" },
  "profile.avatar_changed": { label: "Changed photo", icon: Camera, tone: "neutral", group: "Profile" },
  "profile.avatar_removed": { label: "Removed photo", icon: ImageOff, tone: "neutral", group: "Profile" },
  "ui.unit_changed": { label: "Changed unit", icon: Thermometer, tone: "neutral", group: "Profile" },

  "admin.user_role_changed": { label: "Role changed", icon: ShieldCheck, tone: "warning", group: "Admin" },
  "admin.user_suspended": { label: "User suspended", icon: UserX, tone: "danger", group: "Admin" },
  "admin.user_reactivated": { label: "User reactivated", icon: UserCheck, tone: "success", group: "Admin" },
  "admin.user_deleted": { label: "User deleted", icon: UserMinus, tone: "danger", group: "Admin" },
  "admin.settings_updated": { label: "Settings updated", icon: Settings, tone: "neutral", group: "Admin" },
  "admin.search_deleted": { label: "Search removed", icon: Trash2, tone: "warning", group: "Admin" },
  "admin.favorite_deleted": { label: "Favourite removed", icon: Trash2, tone: "warning", group: "Admin" },
};

export function actionMeta(action) {
  return ACTIONS[action] || { label: action || "Activity", icon: Activity, tone: "neutral", group: "Other" };
}

// Used by the Activity filter dropdown (value is a prefix the API matches on)
export const ACTION_FILTERS = [
  { value: "", label: "All activity" },
  { value: "auth.", label: "Sign-in & account" },
  { value: "weather.", label: "Weather searches" },
  { value: "favorite.", label: "Favourites" },
  { value: "profile.", label: "Profile & preferences" },
  { value: "account.", label: "Security & devices" },
  { value: "alert.", label: "Alert rules" },
  { value: "admin.", label: "Admin actions" },
];
