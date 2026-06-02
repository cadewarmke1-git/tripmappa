/** Daily trial reminder and expiry jobs (Vercel cron). */
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import { sendTripmappaEmail, getUserEmail } from "./email/sendEmail.js";
import { trialEndingTomorrowEmail } from "./email/templates.js";
import { expireTrialIfNeeded, formatEmailDate } from "./trials.js";

function hoursFromNow(hours) {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

export async function runTrialReminderJob(admin) {
  const windowStart = hoursFromNow(20);
  const windowEnd = hoursFromNow(52);

  const { data: profiles, error } = await admin
    .from("user_profiles")
    .select("user_id, trailblazer_trial_ends_at")
    .eq("tier", "trailblazer")
    .is("stripe_subscription_id", null)
    .is("trial_reminder_sent_at", null)
    .gt("trailblazer_trial_ends_at", windowStart)
    .lte("trailblazer_trial_ends_at", windowEnd);

  if (error) throw error;

  let sent = 0;
  for (const profile of profiles || []) {
    try {
      const email = await getUserEmail(admin, profile.user_id);
      if (!email) continue;

      const { subject, html, text } = trialEndingTomorrowEmail({
        trialEndDate: formatEmailDate(profile.trailblazer_trial_ends_at),
      });
      const result = await sendTripmappaEmail({ to: email, subject, html, text });
      if (result.sent) {
        await admin
          .from("user_profiles")
          .update({ trial_reminder_sent_at: new Date().toISOString() })
          .eq("user_id", profile.user_id);
        sent += 1;
      }
    } catch (err) {
      console.error("trial reminder email:", profile.user_id, err.message);
    }
  }

  return { remindersSent: sent };
}

export async function runTrialExpiryJob(admin) {
  const now = new Date().toISOString();

  const { data: profiles, error } = await admin
    .from("user_profiles")
    .select("*")
    .eq("tier", "trailblazer")
    .is("stripe_subscription_id", null)
    .not("trailblazer_trial_ends_at", "is", null)
    .lte("trailblazer_trial_ends_at", now);

  if (error) throw error;

  let expired = 0;
  for (const profile of profiles || []) {
    try {
      const updated = await expireTrialIfNeeded(admin, profile);
      if (updated?.tier === "wanderer" && profile.tier === "trailblazer") {
        expired += 1;
      }
    } catch (err) {
      console.error("trial expiry:", profile.user_id, err.message);
    }
  }

  return { expired };
}

export async function runAllTrialJobs() {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("Database not configured");

  const [reminders, expiries] = await Promise.all([
    runTrialReminderJob(admin),
    runTrialExpiryJob(admin),
  ]);

  return { ...reminders, ...expiries };
}
