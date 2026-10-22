const Task = require("../models/Task");

const createTask = async (req, res) => {
  try {
    const newTask = await Task.create({
      task: req.body.task,
    });

    res.status(201).json(newTask);
  } catch (error) {
    res.status(500).json({
      message: "Failed to create task",
      error: error.message,
    });
  }
};

const getTasks = async (req, res) => {
  try {
    const tasks = await Task.find();

    res.json(tasks);
  } catch (error) {
    res.status(500).json({
      message: "Failed to get tasks",
    });
  }
};
const updateTask = async (req, res) => {
  try {
    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      { task: req.body.task },
      { returndocument: "after" },
    );

    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({
      message: "Failed to update task",
      error: error.message,
    });
  }
};
const deleteTask = async (req, res) => {
  try {
    const deletedTask = await Task.findByIdAndDelete(req.params.id);

    res.json(deletedTask);
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete task",
      error: error.message,
    });
  }
};
module.exports = {
  createTask,
  getTasks,
  updateTask,
  deleteTask,
};












