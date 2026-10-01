import type { ConnectorStatus } from "./types";

export type GoogleSetupStep = {
  id: string;
  title: string;
  body: string;
  done: boolean;
  link?: string;
};

export function googleSetupSteps(
  connection: ConnectorStatus | null,
  saEmail: string,
  bucket: string,
): GoogleSetupStep[] {
  const g = connection?.google;
  const missing = g?.missing ?? [];
  return [
    {
      id: "api",
      title: "Play Developer Reporting API",
      body: "Cloud에서 API를 사용 설정합니다.",
      done: !missing.some((m) => /Reporting API|SERVICE_DISABLED/i.test(m)),
      link: "https://console.cloud.google.com/apis/library/playdeveloperreporting.googleapis.com",
    },
    {
      id: "sa",
      title: "서비스 계정 Play Console 권한",
      body: saEmail ? `${saEmail} 에 재무·앱 조회 권한` : "서비스 계정 이메일 확인",
      done: Boolean(g?.configured),
    },
    {
      id: "bucket",
      title: "GCS 버킷 ACL",
      body: bucket ? `${bucket} 읽기 권한` : "버킷 ID 입력",
      done: Boolean(g?.reports && !missing.some((m) => /GCS|403|ACL/.test(m))),
    },
    {
      id: "bundle",
      title: "PC Chrome 번들(임시)",
      body: "GCS 불가 시 PC에서 zip 갱신 후 배포",
      done: Boolean(g?.reports),
    },
  ];
}
