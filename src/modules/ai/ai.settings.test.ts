import { describe, expect, it } from "vitest";
import { aiGate, maskKey, setSessionKey, getSessionKey, aiRequestHeaders } from "./ai.settings";

describe("ai.settings", () => {
  it("配置读取中不会被当成未配置（否则会误弹空配置窗）", () => {
    expect(aiGate("loading")).toBe("wait");
    expect(aiGate("ready")).toBe("run");
    expect(aiGate("missing")).toBe("configure");
    expect(aiGate("error")).toBe("failed");
  });

  it("maskKey 不暴露完整密钥", () => {
    expect(maskKey("sk-test-0123456789abcdef")).toBe("sk-t…cdef");
    expect(maskKey("short")).toBe("****");
  });

  it("会话密钥只存在于内存，清空后不再随请求发送", () => {
    setSessionKey({ apiKey: "k1", baseUrl: "https://api.deepseek.com", model: "deepseek-flash" });
    expect(getSessionKey()?.model).toBe("deepseek-flash");
    expect(aiRequestHeaders()["x-ai-key"]).toBe("k1");

    setSessionKey(null);
    expect(getSessionKey()).toBeNull();
    expect(aiRequestHeaders()).toEqual({});
  });
});
