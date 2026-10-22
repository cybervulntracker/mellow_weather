const User = require("../models/Users");
const SearchHistory = require("../models/SearchHistory");
const Favorite = require("../models/Favorite");
const UserSession = require("../models/UserSession");
const UserActivity = require("../models/UserActivity");
const DailyUsage = require("../models/DailyUsage");
const Notification = require("../models/Notification");
const AlertRule = require("../models/AlertRule");
const AuthToken = require("../models/AuthToken");

// Removes an account and everything that belongs to it (the activity log is handled by the caller).
async function deleteUserData(userId) {
  await Promise.all([
    SearchHistory.deleteMany({ userId }),
    Favorite.deleteMany({ userId }),
    UserSession.deleteMany({ userId }),
    UserActivity.deleteOne({ userId }),
    DailyUsage.deleteMany({ userId }),
    Notification.deleteMany({ userId }),
    AlertRule.deleteMany({ userId }),
    AuthToken.deleteMany({ userId }),
  ]);
  await User.deleteOne({ _id: userId });
}

module.exports = { deleteUserData };
