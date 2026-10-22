import { useState } from "react";

function Testing() {
  const [message, setMessage] = useState("");

  const checkBackend = async () => {
    try {
      const response = await fetch("/api/test");
      const data = await response.json();

      setMessage(data.message);
    } catch (error) {
      setMessage("Backend connection failed!");
      console.log(error);
    }
  };

  return (
    <div>
      <button onClick={checkBackend}>
        Check Backend
      </button>

      <p>{message}</p>
    </div>
  );
}

export default Testing;