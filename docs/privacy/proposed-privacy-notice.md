# Proposed privacy notice

Draft for the owner. Do not publish this on smartflow.social until the owner fills in the controller
identity, the contact address, the actual subprocessors, and the retention periods. The engineering
inventory is [data-inventory.md](./data-inventory.md).

The current marketing page says the service stores the public key, signed posts, uploaded media,
queue settings, and billing details. That is true and incomplete. It does not mention draft text,
draft version history, encrypted wallet connections, referral records, or the processors above.

## Draft text

**Who we are.** [Legal name and address of the controller. Not invented here.]

**Signing keys.** SmartFlowSocial does not store your Nostr signing key. You sign with a browser
extension or a remote signer on a device you control. We store the public key and the events you
have already signed. We do not sign posts for you.

**Wallet connections.** Connecting a wallet is optional. If you connect an NWC wallet for renewals
or creator payouts, we store that connection encrypted. It is a payment credential. The wallet
provider enforces the permissions and spending limit you set. You can revoke the connection in the
wallet. Referral payouts from the operator, when that program is running, are paid from the
operator's wallet to an invoice or Lightning address you provide.

**What we store.** Draft text and older draft versions, media you upload, schedules and queues,
billing and subscription records, referral balances, and the operational logs needed to publish and
to debug failed jobs.

**How long.** [State the retention period for drafts, media, billing, and logs. The software does
not delete most of these on a timer. Publish-relay acknowledgements are deleted after 30 days.
Events already sent to Nostr relays stay on those relays.]

**Who else processes it.** [List the database host, object storage, publisher, Blossom if used,
error tracking if used, and the relays. Say which country they operate in if you know.]

**Your rights.** If the controller is established in the EU or UK, or offers the service to people
there, you can ask for access, correction, deletion, restriction, and a copy of the data the
controller holds. You can complain to a supervisory authority. The app can delete individual posts.
It does not currently offer one control that exports or erases the whole account. Deleting a row
does not delete events that relays already accepted. When the operator enables delete events, those
events are signed by the operator key in `NOSTR_NSEC`, which is not the user's key.

**Contact.** [A contact that is not only a Nostr profile, if Article 13 requires an identity people
can use. The existing Nostr contact can stay as an additional channel.]

## What changed relative to the 8 November 2026 page

- Say explicitly that signing keys are not stored, and that optional NWC connections are stored
  encrypted.
- Add drafts, draft snapshots, schedules, and referral records.
- Separate the operator wallet from the user's wallet.
- Replace the single "billing details" sentence with the processors the hosted service actually
  uses.
- Add retention and the limits of deletion once an event is on a relay.
- Leave the controller's legal name blank until the owner supplies it.
