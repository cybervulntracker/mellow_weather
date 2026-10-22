import { useState } from "react";
import "./Task.css";

function TaskForm() {
  const [task, setTask] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    console.log("Task being sent:", task);

    const response = await fetch("http://localhost:7000/api/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        task: task,
      }),
    });

    const data = await response.json();

    console.log(data);
  };

  return (
    <div className="task-form-card">
      <div className="task-form-header">
        <h2>Add a New Task</h2>
        <p>Stay organized and get things done.</p>
      </div>

      <form onSubmit={handleSubmit} className="task-form">
        <input
          type="text"
          placeholder="What needs to be done?"
          value={task}
          onChange={(e) => setTask(e.target.value)}
        />

        <button type="submit">
          + Add Task
        </button>

        <p className="task-preview">{task}</p>
      </form>
    </div>
  );
}

export default TaskForm;