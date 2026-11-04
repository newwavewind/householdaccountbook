import { test } from "node:test";
import assert from "node:assert/strict";
import { reportingApiErrorHint } from "./providerErrors.js";
const host = "playdeveloperreporting.googleapis.com";
test("distinguishes disabled reporting API from missing permissions", () => {
  assert.match(reportingApiErrorHint(host, 403, { error: { details: [{ reason: "SERVICE_DISABLED" }] } }) || "", /API가 비활성화/);
  assert.equal(reportingApiErrorHint(host, 403, { error: { details: [{ reason: "IAM_PERMISSION_DENIED" }] } }), undefined);
});
test("does not misdiagnose another API or echo provider content", () => {
  const payload = { error: { message: "private diagnostic", details: [{ reason: "SERVICE_DISABLED" }] } };
  assert.equal(reportingApiErrorHint("androidpublisher.googleapis.com", 403, payload), undefined);
  assert.equal(reportingApiErrorHint(host, 404, payload), undefined);
  for (const bad of [null, "private", {}, { error: { details: "private" } }]) assert.equal(reportingApiErrorHint(host, 403, bad), undefined);
});
