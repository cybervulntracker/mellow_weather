// app.js
const weatherRoutes = require("./routes/weatherRoutes");
const express = require("express");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const { MongoStore } = require("connect-mongo");

const app = express();
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

const taskRoutes = require("./routes/taskRoutes");
const authRoutes = require("./routes/authRoutes");
  const adminRoutes = require("./routes/adminRoutes");
const userRoutes = require("./routes/userRoutes");
const trackRoutes = require("./routes/trackRoutes");
const publicRoutes = require("./routes/publicRoutes");
const accountRoutes = require("./routes/accountRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const geoRoutes = require("./routes/geoRoutes");
const supportRoutes = require("./routes/supportRoutes");
const pushRoutes = require("./routes/pushRoutes");
const { startScheduler } = require("./utils/scheduler");
const { apiLimiter, authLimiter } = require("./middleware/rateLimits");
const maintenance = require("./middleware/maintenance");
const helmet = require("helmet");

dotenv.config();

const PORT = process.env.PORT;

const isProduction = process.env.NODE_ENV === "production";

if (isProduction) {
  // Fail loudly instead of running a production server with a guessable secret
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 24) {
    console.error("SESSION_SECRET must be at least 24 characters in production. Exiting.");
    process.exit(1);
  }
}
// Behind a reverse proxy (nginx, Render, Railway...) the real client IP and HTTPS come from headers
if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);

// Security headers. The API only returns JSON and images, so a strict policy is safe here.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

/* -------------------------------------------
   CORS — MUST allow credentials for session cookies
------------------------------------------- */
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",   // your React dev URL
    credentials: true,                 // ✅ required so cookies are sent/received
  })
);

app.use(express.json({ limit: "3mb" })); // profile photos arrive as small base64 images
app.use(cookieParser());                // ✅ add this so req.cookies works

/* -------------------------------------------
   Session
------------------------------------------- */
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,

    store: MongoStore.create({
      mongoUrl: process.env.DBURL,
    }),

    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24,   // 1 day
      secure: isProduction,          // HTTPS-only cookie in production, plain http on localhost
      sameSite: process.env.COOKIE_SAMESITE || "lax", // use "none" only if the site and API live on different domains
    },
  })
);

/* -------------------------------------------
   Routes
------------------------------------------- */
app.use("/api", apiLimiter);          // generous limit for everything
app.use("/api", maintenance);         // admins keep working while maintenance mode is on
app.use("/api/auth", authLimiter, authRoutes); // stricter limit for sign-in related routes
app.use("/api/tasks", taskRoutes);
app.use("/api/weather", weatherRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/users", userRoutes);
app.use("/api/track", trackRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/geo", geoRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/push", pushRoutes);
app.get("/api/test", (req, res) => {
  res.json({
    message: "Ansh's First Backend connected successfully!",
  });
});
// Lightweight health check for uptime monitors and load balancers
app.get("/api/health", (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ ok: ready, uptime: Math.round(process.uptime()) });
});

// Unknown API routes and unexpected errors answer with JSON, never HTML
app.use("/api", (req, res) => res.status(404).json({ message: "Not found" }));
// Express only treats a function as an error handler when it has 4 parameters, so `next` must stay
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("UNHANDLED ERROR:", err.message);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ message: status === 413 ? "That upload is too large" : "Something went wrong" });
});

/* -------------------------------------------
   Database + Server
------------------------------------------- */
async function connectDB() {
  try {
    await mongoose.connect(process.env.DBURL);
    console.log("Connected to MongoDB");

    // Older search-history rows predate the "count" field — give them 1
    await require("./models/SearchHistory").updateMany({ count: { $exists: false } }, { $set: { count: 1 } });
    // Accounts made before email verification existed are treated as verified
    await require("./models/Users").updateMany({ emailVerified: { $exists: false } }, { $set: { emailVerified: true } });

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      // With RUN_SCHEDULER_IN_APP=0 the notifications run in a separate process (npm run worker)
      if (process.env.RUN_SCHEDULER_IN_APP !== "0") startScheduler();
    });
  } catch (error) {
    console.log("MongoDB connection failed");
    console.log(error);
  }
}

connectDB();