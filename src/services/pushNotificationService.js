import admin from '../config/firebaseAdmin.js';
import prisma from '../lib/prisma.js';

export const PushNotificationType = {
  CHAT: 'CHAT',
  REEL: 'REEL',
  GENERAL: 'GENERAL',
  GENERIC: 'GENERIC',
};

/**
 * Builds the data payload for a push notification based on type, per
 * Himura's spec. FCM data messages only accept string values, so
 * everything gets coerced to string here.
 */
function buildNotificationData({
  type,
  role,
  recipientId,
  title,
  body,
  roomId,
  peerUserId,
  reelId,
  notificationId,
}) {
  if (!type || !role || !recipientId || !title || !body) {
    const error = new Error(
      'type, role, recipientId, title, and body are required'
    );
    error.statusCode = 400;
    throw error;
  }

  const base = {
    type,
    role,
    recipientId: String(recipientId),
    title,
    body,
  };

  switch (type) {
    case PushNotificationType.CHAT:
      if (!roomId || !peerUserId) {
        const error = new Error(
          'CHAT notifications require roomId and peerUserId'
        );
        error.statusCode = 400;
        throw error;
      }
      return { ...base, roomId: String(roomId), peerUserId: String(peerUserId) };

    case PushNotificationType.REEL:
      if (!reelId) {
        const error = new Error('REEL notifications require reelId');
        error.statusCode = 400;
        throw error;
      }
      return { ...base, reelId: String(reelId) };

    case PushNotificationType.GENERAL:
      if (!notificationId) {
        const error = new Error('GENERAL notifications require notificationId');
        error.statusCode = 400;
        throw error;
      }
      return { ...base, notificationId: String(notificationId) };

    case PushNotificationType.GENERIC:
      return base;

    default:
      // Anything not recognized falls back to GENERIC per Himura's spec
      return { ...base, type: PushNotificationType.GENERIC };
  }
}

/**
 * Sends a data-only push notification to a single user, looked up by
 * recipientId's stored device token. No `notification` block is included
 * on purpose — a `notification` block lets FCM/the OS auto-display a
 * system tray notification, bypassing the app's own in-app handling,
 * which is not what was asked for here (data-only, at least for now).
 *
 * Never throws on missing/invalid tokens — a failed push shouldn't take
 * down the request that triggered it (e.g. sending a chat message).
 */
export async function sendPushNotification(payload) {
  const { recipientId } = payload;

  const user = await prisma.user.findUnique({
    where: { id: Number(recipientId) },
    select: { pushToken: true },
  });

  if (!user?.pushToken) {
    return { sent: false, reason: 'no_token' };
  }

  const data = buildNotificationData(payload);

  const message = {
    token: user.pushToken,
    data,
    android: {
      priority: 'high',
    },
    apns: {
      headers: {
        // Silent/background push on iOS: priority must be 5, not 10 —
        // 10 is reserved for alerts that include a `notification` block.
        'apns-priority': '5',
        'apns-push-type': 'background',
      },
      payload: {
        aps: {
          'content-available': 1,
        },
      },
    },
  };

  try {
    const response = await admin.messaging().send(message);
    return { sent: true, response };
  } catch (error) {
    // Token is stale/invalid — clear it so future sends stop failing on it
    if (
      error.code === 'messaging/registration-token-not-registered' ||
      error.code === 'messaging/invalid-registration-token'
    ) {
      await prisma.user.update({
        where: { id: Number(recipientId) },
        data: { pushToken: null },
      });
    }
    console.error(`❌ Push notification failed for user ${recipientId}:`, error.message);
    return { sent: false, reason: 'send_failed', error: error.message };
  }
}