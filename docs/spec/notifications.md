# Notifications and Realtime Spec

Read this when working on: push notifications, in-app updates, subscriptions, deep links.

---

## 1. Principles

- Async-first. Every action must work even if the other player is offline.
- Push should be useful, not spammy.
- Realtime updates improve the experience but cannot be required for correctness.
- Never broadcast hidden answers to hitters.

---

## 2. Push notification types

| Trigger | Recipient | Example copy | Send? |
|---|---|---|---|
| Proposal received | invitee | `Yoni proposed a game.` | Yes |
| Counterproposal received | other player | `Ben countered your game settings.` | Yes |
| Proposal accepted | both | `Game on. Ben accepted your rules.` | Yes |
| First at-bat queued | hitter | `Ben pitched. You're up.` | Yes |
| Additional queued at-bats | hitter | No push by default | No |
| Guess submitted | pitcher | `Yoni guessed.` | Maybe in-app only by default |
| At-bat resolved | pitcher | `Yoni got it: DOUBLE.` | Yes if pitcher offline |
| Half-inning ended | next pitcher | `Your turn to pitch.` | Yes |
| Game completed | both | `Final: Yoni 4, Ben 3.` | Yes |
| Chat message | other player | message preview | Optional/user pref |
| Forfeit available | inactive opponent | `You can claim a forfeit.` | Later |

---

## 3. Deep links

Use app scheme in alpha:

```text
initialbaseball://proposal/<code>
initialbaseball://game/<gameId>
```

Public HTTPS links can be added later with a domain:

```text
https://initialbaseball.app/join/<code>
```

---

## 4. Realtime channels

Use sanitized server-managed updates where possible.

Recommended channels:

| Channel | Payload | Audience |
|---|---|---|
| `proposal:<proposalId>` | settings/status updates | proposal participants |
| `game:<gameId>` | game summary state | game members |
| `atbat:<atBatId>:pitcher` | full pitcher-safe at-bat | pitcher only |
| `atbat:<atBatId>:hitter` | hitter-safe at-bat | hitter only |
| `messages:<gameId>` | chat messages | game members |

Do not subscribe hitter to raw `at_bats` rows that include answer fields.

---

## 5. Notification preferences

Store in `profiles.notification_prefs`.

Alpha defaults:

```json
{
  "turns": true,
  "proposals": true,
  "gameResults": true,
  "chat": true
}
```

---

## 6. Expo Go caveat

Expo Go can be used for basic UI and core flow testing. Push notifications and native auth/deep-link behavior may require development/preview builds. Do not block engine/backend work on App Store/TestFlight setup.
