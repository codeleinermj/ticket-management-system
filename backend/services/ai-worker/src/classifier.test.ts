import { describe, it, expect } from "vitest";
import { ClassificationSchema } from "./classifiers";
import { MockClassifier } from "./classifiers/mock.classifier";

describe("ClassificationSchema", () => {
  it("should validate a correct classification", () => {
    const validData = {
      category: "BUG",
      priority: "HIGH",
      suggestedResponse: "Estamos investigando el problema.",
      confidence: 0.95,
    };

    const result = ClassificationSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category).toBe("BUG");
      expect(result.data.priority).toBe("HIGH");
      expect(result.data.confidence).toBe(0.95);
    }
  });

  it("should reject invalid category", () => {
    const invalidData = {
      category: "INVALID",
      priority: "HIGH",
      suggestedResponse: "Response",
      confidence: 0.5,
    };

    const result = ClassificationSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it("should reject invalid priority", () => {
    const invalidData = {
      category: "BUG",
      priority: "ULTRA",
      suggestedResponse: "Response",
      confidence: 0.5,
    };

    const result = ClassificationSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it("should reject confidence out of range", () => {
    const tooHigh = {
      category: "BUG",
      priority: "HIGH",
      suggestedResponse: "Response",
      confidence: 1.5,
    };
    expect(ClassificationSchema.safeParse(tooHigh).success).toBe(false);

    const tooLow = {
      category: "BUG",
      priority: "HIGH",
      suggestedResponse: "Response",
      confidence: -0.1,
    };
    expect(ClassificationSchema.safeParse(tooLow).success).toBe(false);
  });

  it("should reject missing fields", () => {
    const missing = { category: "BUG" };
    const result = ClassificationSchema.safeParse(missing);
    expect(result.success).toBe(false);
  });

  it("should accept all valid categories", () => {
    const categories = ["BUG", "FEATURE_REQUEST", "SUPPORT", "BILLING", "OTHER"] as const;

    for (const category of categories) {
      const data = {
        category,
        priority: "MEDIUM",
        suggestedResponse: "Test",
        confidence: 0.8,
      };
      expect(ClassificationSchema.safeParse(data).success).toBe(true);
    }
  });

  it("should accept all valid priorities", () => {
    const priorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

    for (const priority of priorities) {
      const data = {
        category: "BUG",
        priority,
        suggestedResponse: "Test",
        confidence: 0.8,
      };
      expect(ClassificationSchema.safeParse(data).success).toBe(true);
    }
  });
});

describe("MockClassifier", () => {
  const classifier = new MockClassifier(0); // no delay for tests

  it("should classify a bug ticket", async () => {
    const result = await classifier.classify({
      title: "App crashes on login",
      description: "The app gives error 500 every time I try to login.",
    });

    expect(result.category).toBe("BUG");
    expect(result.priority).toBe("HIGH");
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.suggestedResponse).toBeTruthy();
  });

  it("should classify a security ticket as CRITICAL", async () => {
    const result = await classifier.classify({
      title: "Security vulnerability found",
      description: "I found a security breach in the authentication system.",
    });

    expect(result.category).toBe("BUG");
    expect(result.priority).toBe("CRITICAL");
  });

  it("should classify a feature request", async () => {
    const result = await classifier.classify({
      title: "Add dark mode feature",
      description: "Please add a dark mode feature to the application.",
    });

    expect(result.category).toBe("FEATURE_REQUEST");
    expect(result.priority).toBe("LOW");
  });

  it("should classify a billing ticket", async () => {
    const result = await classifier.classify({
      title: "Wrong charge on my invoice",
      description: "My billing shows a payment I didn't authorize.",
    });

    expect(result.category).toBe("BILLING");
    expect(result.priority).toBe("MEDIUM");
  });

  it("should default to OTHER for unrecognized tickets", async () => {
    const result = await classifier.classify({
      title: "Hello",
      description: "Just wanted to say hi.",
    });

    expect(result.category).toBe("OTHER");
    expect(result.priority).toBe("MEDIUM");
    expect(result.confidence).toBe(0.6);
  });

  it("should return valid schema-compliant results", async () => {
    const result = await classifier.classify({
      title: "Test ticket",
      description: "Testing the mock classifier.",
    });

    const parsed = ClassificationSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });
});
