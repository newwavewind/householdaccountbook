/** Only expose a known diagnostic, never raw provider error payloads. */
export function reportingApiErrorHint(hostname: string, code: number, payload: unknown): string | undefined {
  if (hostname !== "playdeveloperreporting.googleapis.com" || code !== 403) return;
  if (!payload || typeof payload !== "object") return;
  const error = (payload as { error?: { details?: unknown } }).error;
  if (!Array.isArray(error?.details)) return;
  if (error.details.some(detail => detail && typeof detail === "object" && detail.reason === "SERVICE_DISABLED")) {
    return "Google Play Developer Reporting API가 비활성화되어 있습니다. Google Cloud에서 API를 사용 설정한 뒤 다시 시도해 주세요.";
  }
}
