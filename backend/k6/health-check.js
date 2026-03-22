import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "10s", target: 100 },  // Ramp up to 100 VUs
    { duration: "30s", target: 500 },  // Ramp up to 500 VUs
    { duration: "30s", target: 500 },  // Stay at 500 VUs
    { duration: "10s", target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<200"],   // 95% of requests under 200ms
    http_req_failed: ["rate<0.01"],     // Less than 1% failure
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export default function () {
  const res = http.get(`${BASE_URL}/health`);

  check(res, {
    "status is 200": (r) => r.status === 200,
    "response has status ok": (r) => JSON.parse(r.body).status === "ok",
    "response time < 100ms": (r) => r.timings.duration < 100,
  });

  sleep(0.1);
}
