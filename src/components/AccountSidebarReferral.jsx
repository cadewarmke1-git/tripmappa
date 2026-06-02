import { useState } from "react";
import { copyToClipboard } from "../lib/copyToClipboard.js";

export default function AccountSidebarReferral({ referralLink, onCopied, onCopyError }) {
  const [copying, setCopying] = useState(false);

  if (!referralLink) return null;

  async function handleCopy() {
    setCopying(true);
    const { ok } = await copyToClipboard(referralLink);
    setCopying(false);
    if (ok) onCopied?.();
    else onCopyError?.();
  }

  return (
    <div className="account-sidebar-referral">
      <p className="account-sidebar-referral-label">Your referral link</p>
      <p className="account-sidebar-referral-url">{referralLink}</p>
      <button
        type="button"
        className="account-sidebar-referral-copy"
        onClick={handleCopy}
        disabled={copying}
      >
        {copying ? "Copying…" : "Copy link"}
      </button>
      <p className="account-sidebar-referral-note">
        Friends who sign up through your link get one free month of Voyager. You do too.
      </p>
    </div>
  );
}
