import { auth } from './firebase';

// A notification recipient. Either the signed-in account owner ('self', whose
// key lives in their settings doc) or a team member they own (by team_members id).
export type NotificationRecipient =
  | { type: 'self' }
  | { type: 'member'; id: string };

export interface SendNotificationInput {
  to: NotificationRecipient;
  message: string;
  title?: string;
  url?: string;
  /** Pushover priority (-2…2). Omit for normal. */
  priority?: number;
}

export interface SendNotificationResult {
  success: boolean;
  error?: string;
}

// Send a Pushover push notification from anywhere in the app. The Pushover app
// token stays server-side — this only carries who/what to the /api/notify
// endpoint, authenticated with the current user's Firebase ID token. Never
// throws; returns a result so callers can show a toast/inline message.
export async function sendNotification(input: SendNotificationInput): Promise<SendNotificationResult> {
  try {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) {
      return { success: false, error: 'You must be signed in to send notifications.' };
    }

    const response = await fetch('/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify(input),
    });
    const data = await response.json().catch(() => ({}));

    if (response.ok && data.success) {
      return { success: true };
    }
    return { success: false, error: data.error || 'Failed to send notification.' };
  } catch (err) {
    console.error('sendNotification error:', err);
    return { success: false, error: 'Failed to send notification.' };
  }
}

// Standard payload for the "Send Test" buttons.
export const TEST_NOTIFICATION = {
  message: 'This is a test notification from NR Portal.',
  title: 'Test Notification',
} as const;
