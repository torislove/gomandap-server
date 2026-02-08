import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    try {
        // Check if we are in production (Firebase Functions) or local
        if (process.env.FIREBASE_CONFIG) {
            admin.initializeApp();
        } else {
            // Local development - ensure GOOGLE_APPLICATION_CREDENTIALS is set or use explicit config
            // For now, we'll try default app logic which looks for the env var
            admin.initializeApp({
                credential: admin.credential.applicationDefault()
            });
        }
        console.log('Firebase Admin Initialized for Notifications');
    } catch (error) {
        console.error('Failed to initialize Firebase Admin:', error);
    }
}

export const notificationService = {
    /**
     * Send a push notification to specific tokens
     */
    async sendToTokens(tokens: string[], title: string, body: string, data?: Record<string, string>) {
        if (!tokens.length) return { success: true, failureCount: 0 };

        // Filter out empty tokens
        const validTokens = tokens.filter(t => t && t.length > 0);
        if (validTokens.length === 0) return { success: true, failureCount: 0 };

        try {
            const message: admin.messaging.MulticastMessage = {
                tokens: validTokens,
                notification: {
                    title,
                    body,
                },
                data: data || {},
                android: {
                    priority: 'high',
                    notification: {
                        sound: 'default',
                        channelId: 'default'
                    }
                },
                apns: {
                    payload: {
                        aps: {
                            sound: 'default',
                            contentAvailable: true
                        }
                    }
                }
            };

            const response = await admin.messaging().sendEachForMulticast(message);
            console.log(`FCM Sent: ${response.successCount} success, ${response.failureCount} failure`);

            // Optional: Handle invalid tokens (cleanup DB)
            if (response.failureCount > 0) {
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        console.error(`Token error for ${validTokens[idx]}:`, resp.error);
                    }
                });
            }

            return response;
        } catch (error) {
            console.error('FCM Send Error:', error);
            throw error;
        }
    },

    /**
     * Send a notification to a topic (e.g., 'all-vendors', 'all-clients')
     */
    async sendToTopic(topic: string, title: string, body: string, data?: Record<string, string>) {
        try {
            const message: admin.messaging.Message = {
                topic: topic,
                notification: {
                    title,
                    body
                },
                data: data || {}
            };
            const response = await admin.messaging().send(message);
            console.log(`FCM Topic '${topic}' Sent:`, response);
            return response;
        } catch (error) {
            console.error(`FCM Topic '${topic}' Error:`, error);
            throw error; // Don't crash, just log/throw 
        }
    }
};
