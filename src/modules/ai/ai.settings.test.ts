import { describe, expect, it } from "vitest";
import { maskKey, setSessionKey, getSessionKey, aiRequestHeaders } from "./ai.settings";

describe("ai.settings", () => {
  it("maskKey 不暴露完整密钥", () => {
    expect(maskKey("sk-f03926c06bc949dfac9f2c621ee8874e")).toBe("sk-f…874e");
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
