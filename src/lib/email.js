/**
 * Sends a transactional email through Resend when RESEND_API_KEY and
 * EMAIL_FROM are configured; otherwise it quietly skips so the in-app
 * notification remains the source of truth. Never throws: email delivery
 * must not fail the action that triggered it.
 */
export async function sendEmail({ to, subject, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);

  if (!apiKey || !from || !recipients.length) return { skipped: true };

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: recipients, subject, text }),
    });

    if (!response.ok) {
      console.error("[email] Send failed", response.status, (await response.text()).slice(0, 300));
      return { error: `Email provider returned ${response.status}.` };
    }
    return { sent: true };
  } catch (error) {
    console.error("[email] Send failed", error.message);
    return { error: error.message };
  }
}
