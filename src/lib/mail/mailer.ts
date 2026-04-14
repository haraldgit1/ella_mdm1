import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST!,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === "true",   // true = Port 465 (SSL), false = 587 (STARTTLS)
  auth: {
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!,
  },
});

const FROM = process.env.MAIL_FROM!;

export interface AlarmMailOptions {
  to: string[];
  projectName: string;
  projectTitle: string;
  alarms: { alarm_level_code: string; alarm_text: string; severity_rank: number | null }[];
}

export async function sendAlarmTestMail(opts: AlarmMailOptions) {
  const alarmRows = opts.alarms
    .sort((a, b) => (a.severity_rank ?? 99) - (b.severity_rank ?? 99))
    .map(
      (a) =>
        `<tr>
          <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#c00">${a.alarm_level_code}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0">${a.alarm_text}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;color:#999;text-align:center">${a.severity_rank ?? "—"}</td>
        </tr>`
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#f8f8f8;padding:24px">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <div style="background:#1e3a5f;padding:20px 24px">
      <h2 style="color:#fff;margin:0;font-size:18px">&#9889; Ella MDM &#8212; Test-Alarm</h2>
      <p style="color:#a8c4e0;margin:4px 0 0;font-size:13px">Projekt: ${opts.projectTitle} (${opts.projectName})</p>
    </div>
    <div style="padding:24px">
      <p style="color:#555;margin-top:0">Dies ist eine <strong>Test-Nachricht</strong> mit allen konfigurierten Alarmstufen:</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead>
          <tr style="background:#f5f5f5">
            <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#888">Stufe</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#888">Alarm-Text</th>
            <th style="padding:8px 12px;text-align:center;font-size:11px;text-transform:uppercase;color:#888">Priorität</th>
          </tr>
        </thead>
        <tbody>${alarmRows}</tbody>
      </table>
      <p style="color:#999;font-size:12px;margin-bottom:0;margin-top:20px">
        Gesendet: ${new Date().toLocaleString("de-AT")} &#183; Ella MDM Edge System
      </p>
    </div>
  </div>
</body>
</html>`;

  return transporter.sendMail({
    from: `"Ella MDM" <${FROM}>`,
    to: opts.to.join(", "),
    subject: `[Test] Alarm-Konfiguration — ${opts.projectName}`,
    html,
  });
}
