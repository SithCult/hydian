import { isTauri } from "../core/fs";
import { openPrivacyPolicy, PRIVACY_POLICY_URL } from "../core/privacy";

export function PrivacyPolicyLink() {
  return (
    <a
      className="privacy-policy-link"
      href={PRIVACY_POLICY_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => {
        if (!isTauri()) return;
        event.preventDefault();
        void openPrivacyPolicy();
      }}
    >
      Privacy policy ↗
    </a>
  );
}
