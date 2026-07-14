const fs = require('fs');
const path = require('path');

async function run() {
  console.log("=== STEP 1: Health Check ===");
  let res = await fetch('http://localhost:3004/health');
  if (res.status !== 200) throw new Error("Health check failed");
  console.log("Health: PASS");

  console.log("=== STEP 2: Clean Database ===");
  const { execSync } = require('child_process');
  execSync('sqlite3 data/events.db "DELETE FROM deliveries; DELETE FROM destinations; DELETE FROM events;"');
  console.log("Database Cleaned: PASS");

  console.log("=== STEP 3: Register Destinations ===");
  res = await fetch('http://localhost:3004/destinations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: "Receiver A", type: "http", url: "http://localhost:3004/debug/receiver/a", enabled: true, priority: 1, timeoutMs: 5000
    })
  });
  if (res.status !== 201) throw new Error("Failed to register A: " + await res.text());

  res = await fetch('http://localhost:3004/destinations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: "Receiver B", type: "http", url: "http://localhost:3004/debug/receiver/b", enabled: true, priority: 2, timeoutMs: 5000
    })
  });
  if (res.status !== 201) throw new Error("Failed to register B: " + await res.text());
  console.log("Register Destinations: PASS");

  console.log("=== STEP 4: Verify Registry ===");
  res = await fetch('http://localhost:3004/destinations');
  let data = await res.json();
  if (data.destinations.length !== 2) throw new Error("Expected 2 destinations, got " + data.destinations.length);
  if (!data.destinations[0].enabled || !data.destinations[1].enabled) throw new Error("Not all enabled");
  console.log("Verify Registry: PASS");

  console.log("=== STEP 5: Inject Test Event ===");
  res = await fetch('http://localhost:3004/events/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: "WHATSAPP_TEST", invoice: "KT/26-27/1234", customer: "Kamna Traders", status: "DCR_ISSUED"
    })
  });
  if (res.status !== 200) throw new Error("Event injection failed: " + res.status + " " + await res.text());
  console.log("Inject Test Event: PASS");

  console.log("=== STEP 6: Validate Event Store ===");
  res = await fetch('http://localhost:3004/events');
  data = await res.json();
  if (data.events.length !== 1) throw new Error("Expected 1 event, got " + data.events.length);
  const event = data.events[0];
  if (!event.payload || event.payload.type !== 'WHATSAPP_TEST') throw new Error("Payload mismatch");
  if (!event.eventId) throw new Error("Missing eventId (requestId)");
  console.log("Validate Event Store: PASS");

  console.log("=== STEP 7: Validate Delivery Planner ===");
  res = await fetch('http://localhost:3004/deliveries');
  data = await res.json();
  if (data.deliveries.length !== 2) throw new Error("Expected 2 deliveries, got " + data.deliveries.length);
  if (data.deliveries[0].eventId !== event.eventId) throw new Error("Delivery 0 eventId mismatch");
  if (data.deliveries[1].eventId !== event.eventId) throw new Error("Delivery 1 eventId mismatch");
  console.log("Validate Delivery Planner: PASS");

  console.log("=== STEP 8 & 9: Validate Delivery Status ===");
  let successCount = 0;
  for (const d of data.deliveries) {
    if (d.status === 'success') successCount++;
    if (d.responseCode !== 200) throw new Error("Delivery responseCode not 200: " + d.responseCode);
    if (!d.latencyMs) throw new Error("Latency missing");
    if (!d.responseBody) throw new Error("ResponseBody missing");
    if (!d.completedAt) throw new Error("CompletedAt missing");
  }
  if (successCount !== 2) throw new Error(`Expected 2 successful deliveries, got ${successCount}`);
  
  console.log("Validate Delivery Status: PASS");
  
  console.log("=== ALL VALIDATIONS PASSED ===");
}

run().catch(err => {
  console.error("VALIDATION FAILED:", err.message);
  process.exit(1);
});
