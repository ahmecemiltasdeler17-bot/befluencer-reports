import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  inferProviderErrorCodeFromUserMessage,
  mapActorTerminalStatus,
  mapHttpStatusToProviderError,
  readApifyErrorType,
  TikTokProviderError,
} from "@/lib/providers/tiktok/errors";

describe("mapHttpStatusToProviderError", () => {
  it("maps missing/invalid auth distinctly", () => {
    assert.equal(mapHttpStatusToProviderError(401).code, "auth_failure");
    assert.equal(mapHttpStatusToProviderError(403).code, "auth_failure");
  });

  it("maps actor not found", () => {
    assert.equal(mapHttpStatusToProviderError(404).code, "actor_not_found");
  });

  it("maps rate limit", () => {
    assert.equal(mapHttpStatusToProviderError(429).code, "rate_limit");
  });

  it("maps provider 5xx to upstream_failure", () => {
    assert.equal(mapHttpStatusToProviderError(500).code, "upstream_failure");
    assert.equal(mapHttpStatusToProviderError(503).code, "upstream_failure");
  });

  it("maps Apify usage/payment 402 distinctly from temporary upstream", () => {
    const error = mapHttpStatusToProviderError(
      402,
      "not-enough-usage-to-run-paid-actor"
    );
    assert.equal(error.code, "payment_required");
    assert.match(error.toUserMessage(), /kullanım kotası/i);
    assert.notEqual(error.code, "upstream_failure");
  });
});

describe("readApifyErrorType", () => {
  it("reads error.type without retaining other fields", () => {
    assert.equal(
      readApifyErrorType({
        error: { type: "not-enough-usage-to-run-paid-actor", message: "x" },
      }),
      "not-enough-usage-to-run-paid-actor"
    );
    assert.equal(readApifyErrorType({ data: {} }), null);
  });
});

describe("mapActorTerminalStatus", () => {
  it("maps FAILED / ABORTED distinctly", () => {
    assert.equal(mapActorTerminalStatus("FAILED")?.code, "actor_run_failed");
    assert.equal(mapActorTerminalStatus("ABORTED")?.code, "actor_run_aborted");
    assert.equal(mapActorTerminalStatus("TIMED-OUT")?.code, "actor_run_failed");
    assert.equal(mapActorTerminalStatus("SUCCEEDED"), null);
  });
});

describe("TikTokProviderError catalog", () => {
  it("keeps not_configured distinct from missing payment", () => {
    assert.equal(
      new TikTokProviderError("not_configured").code,
      "not_configured"
    );
    assert.equal(
      new TikTokProviderError("payment_required").toUserMessage().includes(
        "yapılandırılmamış"
      ),
      false
    );
  });

  it("keeps login_required_content distinct from empty/temporary/deleted", () => {
    const error = new TikTokProviderError("login_required_content");
    assert.equal(error.code, "login_required_content");
    assert.match(error.toUserMessage(), /giriş yapılmadan/i);
    assert.notEqual(error.code, "empty_result");
    assert.notEqual(error.code, "upstream_failure");
    assert.notEqual(error.code, "unavailable_video");
    assert.notEqual(error.code, "invalid_url");
  });
});

describe("inferProviderErrorCodeFromUserMessage", () => {
  it("does not permanently classify transient upstream_failure via kullanılamıyor", () => {
    const code = inferProviderErrorCodeFromUserMessage(
      "TikTok veri sağlayıcı geçici olarak kullanılamıyor."
    );
    assert.equal(code, "upstream_failure");
    assert.notEqual(code, "unavailable_video");
  });

  it("maps definitive deleted/private messages to unavailable_video", () => {
    assert.equal(
      inferProviderErrorCodeFromUserMessage(
        "Video kullanılamıyor, gizli veya silinmiş olabilir."
      ),
      "unavailable_video"
    );
  });

  it("maps login_required, invalid_url, empty_result, timeout distinctly", () => {
    assert.equal(
      inferProviderErrorCodeFromUserMessage(
        "TikTok bu videoyu giriş yapılmadan görüntülemeye izin vermiyor."
      ),
      "login_required_content"
    );
    assert.equal(
      inferProviderErrorCodeFromUserMessage("Geçersiz TikTok video bağlantısı."),
      "invalid_url"
    );
    assert.equal(
      inferProviderErrorCodeFromUserMessage(
        "TikTok veri sağlayıcı sonuç döndürmedi."
      ),
      "empty_result"
    );
    assert.equal(
      inferProviderErrorCodeFromUserMessage(
        "TikTok veri sağlayıcı isteği zaman aşımına uğradı."
      ),
      "provider_timeout"
    );
  });

  it("leaves generic unexpected errors retryable (null code)", () => {
    assert.equal(
      inferProviderErrorCodeFromUserMessage(
        "TikTok verisi alınırken beklenmeyen bir hata oluştu."
      ),
      null
    );
  });
});
