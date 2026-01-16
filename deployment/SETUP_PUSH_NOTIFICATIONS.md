# Setup Push Notifications (Critical Steps)

For push notifications to work like WhatsApp (background delivery), you must perform the following server-side configuration.

## 1. Deploy the Edge Function
The backend logic is in `supabase/functions/push-notification`. You must deploy it to your Supabase project.

Run this command in your terminal:
```bash
npx supabase functions deploy push-notification --no-verify-jwt
```

## 2. Configure Secrets
The function needs your Firebase credentials to talk to Google's servers.

1.  Go to **Firebase Console** -> Project Settings -> Service Accounts.
2.  Generate a **New Private Key** (it downloads a JSON file).
3.  Run the following command to set the secrets in Supabase (replace values from your JSON file):

```bash
npx supabase secrets set \
  FIREBASE_PROJECT_ID="your-project-id" \
  FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxx@your-project-id.iam.gserviceaccount.com" \
  FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
```

## 3. Configure Database Webhook
You need to trigger the function when a new message is inserted.

1.  Go to **Supabase Dashboard** -> **Database** -> **Webhooks**.
2.  Click **Create a new webhook**.
3.  **Name**: `push-on-new-message`
4.  **Table**: `public.messages`
5.  **Events**: `INSERT`
6.  **Type**: `HTTP Request`
7.  **URL**: `https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/push-notification`
    *   (Find your URL in the Functions tab of the dashboard)
8.  **Method**: `POST`
9.  **HTTP Headers**:
    *   `Content-Type`: `application/json`
    *   `Authorization`: `Bearer <YOUR_ANON_KEY>` (or Service Role Key)

## 4. Android Configuration
Ensure your `google-services.json` is placed in `android/app/`. This file comes from the Firebase Console (Android App setup).

---
Once these steps are done, the app will automatically register the device token, and the database will trigger the edge function to send high-priority notifications.
