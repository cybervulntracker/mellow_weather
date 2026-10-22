// Tiny user-agent reader — enough for an admin "Sessions" table, no extra package.
function parseUserAgent(ua = "") {
  let browser = "Unknown";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/.test(ua)) browser = "Opera";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Safari\//.test(ua)) browser = "Safari";

  let os = "Unknown";
  if (/Windows/.test(ua)) os = "Windows";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad|iOS/.test(ua)) os = "iOS";
  else if (/Mac OS X|Macintosh/.test(ua)) os = "macOS";
  else if (/Linux/.test(ua)) os = "Linux";

  const device = /Mobile|Android|iPhone/.test(ua) ? "Mobile" : /iPad|Tablet/.test(ua) ? "Tablet" : "Desktop";
  return { browser, os, device };
}

function getClientInfo(req) {
  const ua = req.headers["user-agent"] || "";
  const ip = (req.ip || req.socket?.remoteAddress || "").replace("::ffff:", "");
  return { ip, ...parseUserAgent(ua) };
}

module.exports = { getClientInfo, parseUserAgent };
