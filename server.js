const express = require("express");
const bodyParser = require("body-parser");

const app = express();

// Parse only CloudEvents v1.0 JSON envelopes as raw Buffer
app.use(
  "/notifications",
  bodyParser.raw({ type: "application/cloudevents+json" })
);

let lastNotification = null;

// 1) CloudEvents abuse-protection handshake (OPTIONS)
app.options("/notifications", (req, res) => {
  console.log("OPTIONS request received");

  // Required CloudEvents headers:
  const origin = req.header("WebHook-Request-Origin");
  res.header("WebHook-Allowed-Origin", origin || "*");
  res.header("WebHook-Allowed-Rate", "1000");
  res.header("Allow", "POST, OPTIONS");

  // Also include CORS so browser clients work:
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, aeg-event-type");

  console.log("OPTIONS response sent");
  return res.status(200).send("OK");
});

// 2) Handle SubscriptionValidation (for EventGrid schema) & normal events
app.post("/notifications", (req, res) => {
  const aegType = req.header("aeg-event-type");
  let body;

  try {
    body = JSON.parse(req.body.toString("utf8")); // 🛠 Parse Buffer to JSON object
  } catch (err) {
    console.error("❌ Failed to parse CloudEvent body:", err);
    return res.status(400).send("Invalid body");
  }

  console.log("▶️ Received CloudEvent");
  console.log("Headers:", req.headers);
  console.log("Parsed Body:", body);
  console.log("Parsed message:", body?.data?.message);

  if (aegType === "SubscriptionValidation") {
    const code = req.body[0]?.data?.validationCode;
    console.log("🔐 SubscriptionValidation code:", code);
    return res.status(200).json({ validationResponse: code }); // EventGrid-schema handshake
  }

  console.log("📨 Notification received:", req.body);
  lastNotification = req.body;
  return res.sendStatus(200);
});

// 3) Expose last notification for UI polling
app.get("/notifications/last", (req, res) => {
  console.log("Received GET request at /notifications/last");
  if (lastNotification) {
    console.log("Last Notification: ", lastNotification);
    res.json(lastNotification);
  } else {
    // console.log("No notifications received yet");
    res.status(404).json({ error: "No notifications yet" });
  }
});

app.listen(4002, () => console.log("Receiver on port 4002"));
