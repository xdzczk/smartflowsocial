# Nostr Authentication Troubleshooting Guide

This guide helps you resolve common issues with Nostr authentication (NIP-07 and NIP-46) in
SmartFlowSocial.

## Table of Contents

- [Quick Diagnosis](#quick-diagnosis)
- [NIP-07 (Browser Extension) Issues](#nip-07-browser-extension-issues)
- [NIP-46 (Remote Signer) Issues](#nip-46-remote-signer-issues)
- [Platform-Specific Issues](#platform-specific-issues)
- [Common Error Messages](#common-error-messages)
- [Advanced Troubleshooting](#advanced-troubleshooting)
- [FAQ](#faq)

---

## Quick Diagnosis

### Extension Not Detected (NIP-07)

**Symptoms:**

- Button shows "Extension not detected" warning
- Extension icon not visible in browser

**Quick Fix:**

1. Install a Nostr browser extension:
   - [Alby](https://getalby.com) (Chrome, Firefox, Safari)
   - [nos2x](https://github.com/fiatjaf/nos2x) (Chrome, Firefox)
   - [Amber](https://amber.app) (Chrome, Firefox)
2. Refresh the page
3. Grant extension permissions if prompted

### Connection Fails on First Attempt (NIP-46)

**Symptoms:**

- "Subscription closed" error on first connection attempt
- Works after 1-2 retries

**Quick Fix:**

- This is normal on mobile devices (especially iOS)
- The app automatically retries with exponential backoff
- Wait for automatic retry or click "Try again"

### App Switching Issues (Mobile)

**Symptoms:**

- Connection lost when switching to signer app
- "Returning from signer app" message appears

**Quick Fix:**

- Wait 1-2 seconds after returning to the app
- Connection will resume automatically
- If it doesn't, click "Try again"

---

## NIP-07 (Browser Extension) Issues

### Extension Not Detected

**Problem:** The app doesn't detect your Nostr extension.

**Solutions:**

1. **Verify Extension is Installed:**
   - Check browser extensions page
   - Ensure extension is enabled
   - Some extensions require browser restart

2. **Check Extension Permissions:**
   - Open extension settings
   - Ensure it has permission to access the website
   - Grant permissions if prompted

3. **Extension Injection Delay:**
   - Some extensions inject `window.nostr` asynchronously
   - Wait a few seconds and refresh the page
   - The app will automatically detect when extension loads

4. **Try Different Extension:**
   - If one extension doesn't work, try another
   - Alby, nos2x, and Amber are all supported

### Extension Not Responding

**Problem:** Extension is detected but doesn't respond to requests.

**Solutions:**

1. **Restart Extension:**
   - Disable and re-enable the extension
   - Reload the page

2. **Check Extension Status:**
   - Open extension popup
   - Verify extension is unlocked
   - Check for error messages in extension

3. **Clear Extension Cache:**
   - Some extensions cache state
   - Try logging out and back into the extension

### Profile Mismatch

**Problem:** "Different signer profile detected" error.

**Solutions:**

1. **Switch Profile in Extension:**
   - Open extension popup
   - Switch to the expected profile/account
   - Try again

2. **Check Expected Profile:**
   - If you're switching accounts, ensure you're using the correct profile
   - Each profile represents a different identity (pubkey)

---

## NIP-46 (Remote Signer) Issues

### Connection Fails Immediately

**Problem:** Connection fails with "Subscription closed" or "Connection closed" error.

**Solutions:**

1. **Check Relay List:**
   - Remove unreachable relays
   - Add alternative relays (see recommended relays below)
   - Test relay connectivity using the relay status indicator

2. **Try Bunker Input Method:**
   - Switch to "Paste bunker input" tab
   - Use bunker:// URI from your signer app
   - This method is more reliable on some signers

3. **Wait and Retry:**
   - On mobile, first attempt often fails due to WebSocket initialization
   - App automatically retries with exponential backoff
   - Wait for automatic retry or manually retry after 2-3 seconds

### Connection Times Out

**Problem:** Connection attempt times out after 2 minutes.

**Solutions:**

1. **Check Signer App Status:**
   - Ensure signer app is running
   - Check if signer app is connected to relays
   - Restart signer app if needed

2. **Verify Approval:**
   - Check signer app for pending approval requests
   - Approve the connection request
   - Some signers require explicit approval

3. **Update Relay List:**
   - Use relays that your signer app can reach
   - Remove slow or unreachable relays
   - Add relays that your signer app uses

### Mobile App Switching Issues

**Problem:** Connection lost when switching to signer app on mobile.

**Solutions:**

1. **Proactive connection handling:**
   - The app **proactively** closes the NIP-46 connection when the tab or app is backgrounded on
     **mobile** only (desktop keeps the connection alive while the tab is hidden), and when the
     browser freezes the page where supported.
   - When you return, the next action may trigger a quick reconnection instead of failing once. The
     first **sign** after resume should then work without showing "Remote signer did not respond"
     first.

2. **Wait for Auto-Resume:**
   - After returning from signer app, wait 1-2 seconds
   - Connection will automatically resume
   - Progress indicator shows connection status

3. **Manual Retry:**
   - If auto-resume doesn't work, click "Try again"
   - Connection will restart with fresh WebSocket

4. **Use Bunker Input:**
   - Bunker input method is more stable on mobile
   - Copy bunker:// URI before starting connection
   - Paste when ready to connect

---

## Platform-Specific Issues

### iOS (iPhone/iPad)

**Common Issues:**

- WebSocket connections close when app is backgrounded
- First connection attempt often fails
- Connection requires multiple retries

**Solutions:**

- The app proactively closes the NIP-46 connection when the tab or app is backgrounded, so when you
  return the next action triggers a quick reconnection instead of failing once.
- App automatically handles iOS-specific issues
- Wait for automatic retry (1-2 seconds)
- Connection cooldown period helps stabilize WebSockets
- Use bunker input method for more reliable connections

### Android

**Common Issues:**

- Similar to iOS but less frequent
- WebSocket connections more stable than iOS

**Solutions:**

- The app proactively closes the NIP-46 connection when backgrounded; when you return, the next
  action may briefly show reconnecting, then work normally.
- Same as iOS but issues occur less frequently
- Automatic retry handles most cases

### Desktop

**Common Issues:**

- Generally most stable platform
- Extension detection issues
- Network/firewall blocking WebSockets

**Solutions:**

- On desktop, the NIP-46 connection is **not** closed when you switch tabs; returning to the tab
  lets you post without reconnecting.
- On browsers that support it (Chrome, Edge, Android), the app also reacts to the Page Lifecycle
  "freeze" event to improve reliability when the tab is suspended.
- Check firewall settings
- Ensure WebSocket connections are allowed
- Verify extension is installed and enabled

---

## Common Error Messages

### "Couldn't connect to remote signer"

**Meaning:** Connection to remote signer failed before approval completed.

**Solutions:**

1. Check relay list - remove unreachable relays
2. Try bunker input method instead
3. Wait and retry (especially on mobile)
4. Verify signer app is running and connected

### "Subscription closed before connection was established"

**Meaning:** WebSocket subscription closed before connection completed.

**Solutions:**

1. This is common on first attempt (especially mobile)
2. Wait for automatic retry
3. Check relay connectivity
4. Try different relay list

### "No approval received in time"

**Meaning:** Signer app didn't respond within timeout period.

**Solutions:**

1. Open signer app and approve request
2. Check if signer app is running
3. Verify signer app can reach relays
4. Increase timeout (if supported by signer)

### "Different signer profile detected"

**Meaning:** Connected profile doesn't match expected profile.

**Solutions:**

1. Switch to expected profile in signer app
2. Use correct profile for your account
3. Each profile = different identity

### "Too many recent failures"

**Meaning:** Circuit breaker activated due to repeated failures.

**Solutions:**

1. Wait 30 seconds before retrying
2. Check relay connectivity
3. Verify signer app status
4. Try different connection method

---

## Advanced Troubleshooting

### Check Connection Health

The app performs automatic health checks every 30 seconds for active NIP-46 connections. If a
connection becomes stale, it's automatically cleared and reconnected.

### View Connection Metrics

Connection metrics are stored locally (anonymized) and used to:

- Adjust timeouts based on historical data
- Improve connection success rates
- Provide better error recovery

### Reset Circuit Breaker

If circuit breaker is stuck in "open" state:

1. Wait 30 seconds (automatic reset)
2. Clear browser sessionStorage (developer tools)
3. Refresh page

### Debug Mode

Enable browser console to see:

- Connection attempts and retries
- Health check results
- Error details
- Circuit breaker state changes

---

## FAQ

### Why does connection fail on first attempt?

**Answer:** This is especially common on mobile devices (iOS/Android) due to:

- WebSocket connections needing time to stabilize after app becomes visible
- Network initialization delays
- App lifecycle events (backgrounding/foregrounding)

The app automatically retries with exponential backoff, and subsequent attempts usually succeed.
After returning from background, the first attempt may briefly show reconnecting—this is expected.
The first **sign** after resume should then work without showing "Remote signer did not respond"
first.

### How do I switch between signer profiles?

**Answer:**

1. In your signer app, switch to the desired profile
2. In SmartFlowSocial, sign out
3. Sign in again - the new profile will be used

Each profile represents a different identity (pubkey), so switching profiles requires
re-authentication.

### What to do if extension isn't detected?

**Answer:**

1. Verify extension is installed and enabled
2. Check extension permissions
3. Refresh the page (extensions may inject with delay)
4. Try a different extension (Alby, nos2x, Amber)
5. Check browser console for errors

### Why does connection timeout after 2 minutes?

**Answer:**

- First attempt: 2 minutes (120s)
- Retry 1: 1 minute (60s) - progressive timeout
- Retry 2: 30 seconds - further reduced

Timeouts are progressive to fail faster on retries. If timeout occurs:

1. Check signer app is running
2. Approve connection in signer app
3. Verify relay connectivity

### How to improve connection success rate?

**Answer:**

1. **Use reliable relays:**
   - `wss://relay.primal.net`
   - `wss://relay.damus.io`
   - `wss://relay.nostr.band`

2. **Remove unreachable relays:**
   - Check relay status indicator
   - Remove failed relays
   - Add alternatives

3. **Use bunker input method:**
   - More reliable on mobile
   - Direct connection to signer

4. **Wait for automatic retry:**
   - Don't immediately retry manually
   - Let exponential backoff work

### What's the difference between bunker input and nostrconnect URI?

**Answer:**

- **Bunker Input:** Direct connection using `bunker://` URI
  - More reliable on mobile
  - Single relay connection
  - Faster connection establishment

- **Nostrconnect URI:** Standard NIP-46 connection
  - Multiple relay support
  - QR code scanning support
  - More flexible relay selection

Both methods work, but bunker input is recommended for mobile devices.

### How does circuit breaker work?

**Answer:** Circuit breaker prevents hammering failed connections:

- **Closed:** Normal operation, allows attempts
- **Open:** Too many failures (3+), blocks attempts for 30s
- **Half-Open:** After cooldown, allows 1 test attempt
- **Back to Closed:** On success, resets to normal

This prevents wasting resources on persistently failing connections.

---

## Recommended Relays

For best connection reliability, use these relays:

```
wss://relay.primal.net
wss://relay.damus.io
wss://relay.nostr.band
wss://relay.snort.social
wss://relay.bullishbounty.com
```

**Tips:**

- Use 3-5 relays for redundancy
- Remove relays that consistently fail
- Test relay connectivity before adding
- Prefer relays with good uptime

---

## Getting Help

If you continue to experience issues:

1. **Check Error Details:**
   - Click "Advanced Troubleshooting" in error message
   - Copy error details for support

2. **Check Browser Console:**
   - Open developer tools (F12)
   - Look for error messages
   - Note any WebSocket errors

3. **Contact Support:**
   - Include error details
   - Specify platform (iOS/Android/Desktop)
   - Describe steps to reproduce

---

## Authentication Flow Diagrams

### NIP-07 Flow

```
User clicks "Browser Extension"
    ↓
Check window.nostr availability
    ↓
Request public key from extension
    ↓
User approves in extension
    ↓
Get public key
    ↓
Request server challenge
    ↓
Sign challenge with extension
    ↓
User approves signature
    ↓
Verify signature on server
    ↓
Create session → Redirect to dashboard
```

### NIP-46 Flow

```
User selects "Remote Signer"
    ↓
Choose method (bunker/nostrconnect)
    ↓
Generate connection URI
    ↓
User approves in signer app
    ↓
Establish WebSocket connection
    ↓
Request public key from signer
    ↓
Get public key
    ↓
Request server challenge
    ↓
Sign challenge with signer
    ↓
User approves signature
    ↓
Verify signature on server
    ↓
Create session → Redirect to dashboard
```

### Error Recovery Flow

```
Error occurs
    ↓
Classify error type
    ↓
Network Error? → Exponential backoff retry
Timeout Error? → Progressive timeout retry
Permission Error? → Show clear message (no retry)
    ↓
Check circuit breaker
    ↓
Open? → Wait for cooldown
Closed? → Allow retry
    ↓
Retry with adjusted strategy
    ↓
Success? → Reset circuit breaker
Failure? → Record failure, update circuit breaker
```

---

## Best Practices

1. **Use Reliable Relays:**
   - Test relay connectivity before adding
   - Remove consistently failing relays
   - Use 3-5 relays for redundancy

2. **Mobile Best Practices:**
   - Wait for automatic retry (don't immediately retry)
   - Use bunker input method for better reliability
   - Keep signer app running during connection

3. **Extension Best Practices:**
   - Keep extension unlocked
   - Grant necessary permissions
   - Use extension's latest version

4. **Troubleshooting Order:**
   1. Check relay connectivity
   2. Verify signer app status
   3. Try different connection method
   4. Wait for automatic retry
   5. Check error details for specific guidance

---

## Related Documentation

- [Nostr Integration Guide](../reference/nostr.md) - Technical details
- [Common Issues](./common-issues.md) - General troubleshooting
- [Error Codes](../reference/error-codes.md) - Error reference
