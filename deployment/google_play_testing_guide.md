# Google Play Console - Closed Testing Guide

Follow these steps to deploy your `app-release.aab` to a closed testing track.

## Prerequisites
- Google Play Developer Account.
- App created in the console.
- Signed App Bundle (`app-release.aab`) ready.

## Step 1: Set up Testers
1. Log in to **Google Play Console**.
2. Select your app **VoxSpace**.
3. In the left menu, go to **Testing > Closed testing**.
4. Click **Manage track** (usually "Alpha" or create a custom track).
5. Click the **Testers** tab.
6. Create an **Email list**:
   - Add the Gmail addresses of all your testers.
   - Save the list and select it for this track.
7. Click **Save**.

## Step 2: Create a Release
1. Go to the **Releases** tab (still in Closed testing).
2. Click **Create release**.
3. **App bundles**: Drag and drop your `app-release.aab` file here.
4. **Release Name**: Name it (e.g., "1.1.0 Alpha 1").
5. **Release Notes**: Paste your "What's New":
   ```
   * Native Contact Sharing added.
   * Scrolling performance improvements.
   * Bug fixes.
   ```
6. Click **Next**.

## Step 3: Review and Rollout
1. You may see warnings (e.g., about mapping files - okay to ignore for now).
2. If there are **Errors**, they must be fixed before proceeding.
3. Click **Start rollout to Closed testing**.
4. The update will go into "In Review" status (can take a few hours to days).

## Step 4: Invite Testers
1. Once the release is approved/live:
2. Go back to **Testing > Closed testing > Testers**.
3. Scroll down to "How testers join your test".
4. Copy the **Join on Web** link.
5. Send this link to your testers.
6. They must open the link, click "Become a Tester", and then they can download the app from the Play Store.
