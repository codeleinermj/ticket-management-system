import http from "k6/http";
import { check, group, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const errorRate = new Rate("errors");
const ticketCreationDuration = new Trend("ticket_creation_duration");

export const options = {
  scenarios: {
    ticket_creation: {
      executor: "ramping-arrival-rate",
      startRate: 10,
      timeUnit: "1s",
      preAllocatedVUs: 100,
      maxVUs: 600,
      stages: [
        { duration: "10s", target: 100 },
        { duration: "30s", target: 500 },  // Target: 500 req/sec
        { duration: "30s", target: 500 },
        { duration: "10s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<500", "p(99)<1000"],
    errors: ["rate<0.05"],
    ticket_creation_duration: ["p(95)<800"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const AUTH_TOKEN = __ENV.AUTH_TOKEN || "";

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${AUTH_TOKEN}`,
};

const ticketTemplates = [
  {
    title: "App crashes on startup",
    description: "The application crashes immediately after launching on Windows 10. Error code: 0xDEADBEEF. This started after the latest update.",
    priority: "CRITICAL",
    category: "BUG",
  },
  {
    title: "Add dark mode support",
    description: "It would be great to have a dark mode option in the settings. Many users have requested this feature for better nighttime usage.",
    priority: "LOW",
    category: "FEATURE_REQUEST",
  },
  {
    title: "Cannot reset password",
    description: "When I click the reset password link, I get a 404 error. I have tried multiple browsers and cleared my cache but the issue persists.",
    priority: "HIGH",
    category: "SUPPORT",
  },
  {
    title: "Billing discrepancy on invoice",
    description: "My latest invoice shows a charge of $99 but my plan is $49/month. I need this corrected as soon as possible please review my account.",
    priority: "HIGH",
    category: "BILLING",
  },
  {
    title: "How to export data",
    description: "I need to export all my project data to CSV format. Is there a way to do this from the dashboard? I could not find the option anywhere.",
    priority: "MEDIUM",
    category: "SUPPORT",
  },
];

export default function () {
  group("Create Ticket Flow", () => {
    const template = ticketTemplates[Math.floor(Math.random() * ticketTemplates.length)];

    const payload = JSON.stringify({
      title: `${template.title} - ${Date.now()}`,
      description: template.description,
      priority: template.priority,
    });

    const start = Date.now();

    const res = http.post(`${BASE_URL}/api/tickets`, payload, { headers });

    ticketCreationDuration.add(Date.now() - start);

    const success = check(res, {
      "ticket created (201)": (r) => r.status === 201,
      "response has ticket data": (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.success === true && body.data && body.data.id;
        } catch {
          return false;
        }
      },
      "response time < 500ms": (r) => r.timings.duration < 500,
    });

    errorRate.add(!success);
  });

  sleep(0.05);
}
