const express = require("express");
const { createTask,getTasks,updateTask, deleteTask } = require("../controllers/taskController");

const router = express.Router();
const requireAuth = require("../middleware/requireAuth");
router.post("/", requireAuth, createTask);
router.get("/", requireAuth, getTasks);
router.put("/:id", requireAuth, updateTask);
router.delete("/:id", requireAuth, deleteTask);

module.exports = router;