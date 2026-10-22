function ContactUs() {

  const handleSubmit = async (e) => {
    e.preventDefault();

    const response = await fetch("http://localhost:5000/contact", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: e.target.name.value,
        message: e.target.message.value
      })
    });

    const data = await response.json();

    alert(data.message);
  };

  return (
    <div>
      <h2>Contact Us</h2>

      <form onSubmit={handleSubmit}>

        <input
          name="name"
          placeholder="Your name"
        />

        <br /><br />

        <textarea
          name="message"
          placeholder="Your message"
        />

        <br /><br />

        <button type="submit">
          Send
        </button>

      </form>
    </div>
  );
}

export default ContactUs;