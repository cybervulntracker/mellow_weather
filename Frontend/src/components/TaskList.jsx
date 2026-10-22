import { useEffect, useState } from "react";
import "./Task.css";

function TaskList() {
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    const getTasks = async () => {
      const response = await fetch("api/tasks", {
        credentials: "include",
      });

      const data = await response.json();

      setTasks(data);
    };

    getTasks();
  }, []);

  return (
    <div className="task-list-card">
      <div className="task-list-header">
        <div>
          <h2>My Tasks</h2>
          <p>Things you need to get done.</p>
        </div>

        <span className="task-count">
          {tasks.length}
        </span>
      </div>

      <div className="tasks-container">
        {tasks.map((task) => (
          <div className="task-item" key={task._id}>
            <div className="task-check"></div>

            <p>{task.task}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TaskList;