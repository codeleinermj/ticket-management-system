import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AIClassifier } from "./classifiers";

// Mock Prisma
const mockPrismaTicketUpdate = vi.fn();
const mockPrismaAuditCreate = vi.fn();
const mockPrismaAiResultCreate = vi.fn();

vi.mock("@repo/database", () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    ticket: { update: mockPrismaTicketUpdate },
    auditLog: { create: mockPrismaAuditCreate },
    aiResult: { create: mockPrismaAiResultCreate },
  })),
}));

// Mock Redis publisher
function createMockPublisher() {
  return { publish: vi.fn().mockResolvedValue(1) } as any;
}

describe("processTicket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should classify and update ticket on success", async () => {
    const mockClassifier: AIClassifier = {
      name: "TestClassifier",
      classify: vi.fn().mockResolvedValue({
        category: "BUG",
        priority: "HIGH",
        suggestedResponse: "Estamos investigando el bug reportado.",
        confidence: 0.92,
      }),
    };

    const mockPublisher = createMockPublisher();
    mockPrismaTicketUpdate.mockResolvedValue({});
    mockPrismaAuditCreate.mockResolvedValue({});
    mockPrismaAiResultCreate.mockResolvedValue({});

    const { processTicket } = await import("./processor");

    await processTicket(
      "ticket-123",
      { title: "App crashes on login", description: "The app crashes every time I try to login with Google OAuth." },
      mockClassifier,
      mockPublisher,
    );

    expect(mockClassifier.classify).toHaveBeenCalledWith({
      title: "App crashes on login",
      description: "The app crashes every time I try to login with Google OAuth.",
    });

    expect(mockPrismaTicketUpdate).toHaveBeenCalledWith({
      where: { id: "ticket-123" },
      data: {
        category: "BUG",
        priority: "HIGH",
        aiResponse: "Estamos investigando el bug reportado.",
        aiStatus: "CLASSIFIED",
        confidence: 0.92,
      },
    });

    expect(mockPrismaAiResultCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ticketId: "ticket-123",
        provider: "TestClassifier",
        category: "BUG",
        priority: "HIGH",
        confidence: 0.92,
      }),
    });

    expect(mockPrismaAuditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "AI_CLASSIFICATION",
        ticketId: "ticket-123",
        userId: null,
      }),
    });

    // Verify ticket.classified event was published
    expect(mockPublisher.publish).toHaveBeenCalledWith(
      "ticket-events",
      expect.stringContaining("ticket.classified"),
    );

    const publishedPayload = JSON.parse(mockPublisher.publish.mock.calls[0][1]);
    expect(publishedPayload.event).toBe("ticket.classified");
    expect(publishedPayload.ticketId).toBe("ticket-123");
    expect(publishedPayload.data.category).toBe("BUG");
    expect(publishedPayload.data.confidence).toBe(0.92);
  });

  it("should mark ticket as PENDING_MANUAL_REVIEW on failure and publish ai_failed", async () => {
    const failingClassifier: AIClassifier = {
      name: "FailingClassifier",
      classify: vi.fn().mockRejectedValue(new Error("API error")),
    };

    const mockPublisher = createMockPublisher();
    mockPrismaTicketUpdate.mockResolvedValue({});
    mockPrismaAuditCreate.mockResolvedValue({});

    const { processTicket } = await import("./processor");

    const promise = processTicket(
      "ticket-456",
      { title: "Some issue", description: "Something went wrong with the application." },
      failingClassifier,
      mockPublisher,
    );

    // Advance through retry delays (1000ms + 4000ms)
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(4000);

    await promise;

    // Should have retried 3 times
    expect(failingClassifier.classify).toHaveBeenCalledTimes(3);

    expect(mockPrismaTicketUpdate).toHaveBeenCalledWith({
      where: { id: "ticket-456" },
      data: {
        status: "PENDING_MANUAL_REVIEW",
        aiStatus: "FAILED",
      },
    });

    expect(mockPrismaAuditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "AI_CLASSIFICATION_FAILED",
        ticketId: "ticket-456",
        field: "status",
        newValue: "PENDING_MANUAL_REVIEW",
      }),
    });

    // Verify ticket.ai_failed event was published
    expect(mockPublisher.publish).toHaveBeenCalledWith(
      "ticket-events",
      expect.stringContaining("ticket.ai_failed"),
    );

    const publishedPayload = JSON.parse(mockPublisher.publish.mock.calls[0][1]);
    expect(publishedPayload.event).toBe("ticket.ai_failed");
    expect(publishedPayload.data.error).toBe("API error");
  });

  it("should retry and succeed after transient failures", async () => {
    const retryClassifier: AIClassifier = {
      name: "RetryClassifier",
      classify: vi.fn()
        .mockRejectedValueOnce(new Error("Timeout"))
        .mockRejectedValueOnce(new Error("Rate limited"))
        .mockResolvedValueOnce({
          category: "SUPPORT",
          priority: "MEDIUM",
          suggestedResponse: "Gracias por contactarnos.",
          confidence: 0.78,
        }),
    };

    const mockPublisher = createMockPublisher();
    mockPrismaTicketUpdate.mockResolvedValue({});
    mockPrismaAuditCreate.mockResolvedValue({});
    mockPrismaAiResultCreate.mockResolvedValue({});

    const { processTicket } = await import("./processor");

    const promise = processTicket(
      "ticket-789",
      { title: "Help needed", description: "I need help with my account settings." },
      retryClassifier,
      mockPublisher,
    );

    // Advance through retry delays (1000ms + 4000ms)
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(4000);

    await promise;

    // Should have been called 3 times (2 failures + 1 success)
    expect(retryClassifier.classify).toHaveBeenCalledTimes(3);

    // Should have succeeded — ticket updated with CLASSIFIED
    expect(mockPrismaTicketUpdate).toHaveBeenCalledWith({
      where: { id: "ticket-789" },
      data: expect.objectContaining({
        aiStatus: "CLASSIFIED",
        category: "SUPPORT",
      }),
    });

    // Should publish ticket.classified (not ai_failed)
    const publishedPayload = JSON.parse(mockPublisher.publish.mock.calls[0][1]);
    expect(publishedPayload.event).toBe("ticket.classified");
  });
});
