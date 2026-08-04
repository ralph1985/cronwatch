export type JobSource = "user-crontab" | "system-crontab" | "cron.d" | "systemd";

export interface ScheduledJob {
  id: string;
  source: JobSource;
  schedule: string;
  command: string;
  user?: string;
  file?: string;
  raw: string;
}

export interface Evidence {
  collectedAt: string;
  timezone: string;
  window: { start: string; end: string };
  jobs: ScheduledJob[];
  sources: Array<{ source: string; ok: boolean; detail?: string }>;
  logs: Array<{ source: string; content: string; truncated: boolean }>;
  context: Array<{ path: string; content: string; truncated: boolean }>;
  backups: BackupCheck[];
  warnings: string[];
}

export interface BackupCheck {
  project: string;
  provider: string;
  status: "OK" | "FALLO" | "SIN EVIDENCIA";
  observedAt?: string;
  detail: string;
}
