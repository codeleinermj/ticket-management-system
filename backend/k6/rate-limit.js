import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const rateLimited = new Rate("rate_limited");

export const options = {
  scenarios: {
    burst_test: {
      executor: "constant-arrival-rate",
      rate: 200,             // 200 requests per second from single IP
      timeUnit: "1s",
      duration: "30s",
      preAllocatedVUs: 50,
      maxVUs: 250,
    },
  },
  thresholds: {
    rate_limited: ["rate>0.3"],  // Expect >30% to be rate limited
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export default function () {
  const res = http.get(`${BASE_URL}/health`);

  const isLimited = res.status === 429;

  check(res, {
    "status is 200 or 429": (r) => r.status === 200 || r.status === 429,
    "rate limited responses have Retry-After": (r) =>
      r.status !== 429 || r.headers["Retry-After"] !== undefined,
  });

  rateLimited.add(isLimited);
}
