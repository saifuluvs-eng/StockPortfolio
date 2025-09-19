# Stock Portfolio Authentication

The API now uses Firebase Authentication tokens instead of server-side sessions. Clients must include a Firebase ID token in the `Authorization` header when calling protected endpoints.

```
Authorization: Bearer <firebase-id-token>
```

## Firebase Admin configuration

Set the following environment variables so the API can initialize the Firebase Admin SDK:

| Variable | Required | Description |
| --- | --- | --- |
| `FIREBASE_PROJECT_ID` | Yes | Firebase project identifier used for Admin initialization. |
| `FIREBASE_CLIENT_EMAIL` | Yes (unless `FIREBASE_SERVICE_ACCOUNT_PATH` or `FIREBASE_SERVICE_ACCOUNT_JSON` is provided) | Client email from the service account credentials. |
| `FIREBASE_PRIVATE_KEY` | Yes (unless `FIREBASE_SERVICE_ACCOUNT_PATH` or `FIREBASE_SERVICE_ACCOUNT_JSON` is provided) | Private key from the service account. Replace literal `\n` sequences with real newlines if the key is stored in a `.env` file. |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Optional | Path to a service-account JSON file. If set, the file is read and overrides the individual credential variables above. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Optional | Raw JSON string of the service-account credentials. Useful for platforms that expose credentials as environment variables. |

Provide either `FIREBASE_SERVICE_ACCOUNT_PATH`, `FIREBASE_SERVICE_ACCOUNT_JSON`, or the combination of `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`.
## Client Firebase configuration

The Vite client requires the Firebase web configuration to be present at build time. Configure the following environment variables before running `vite build`; otherwise the client throws the `Missing Firebase configuration values` error from [`client/src/lib/firebase.ts`](client/src/lib/firebase.ts):

| Variable | Description |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | Firebase Web API key. |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain (e.g. `your-project.firebaseapp.com`). |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project identifier. |
| `VITE_FIREBASE_STORAGE_BUCKET` | Cloud Storage bucket name. |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Cloud Messaging sender ID. |
| `VITE_FIREBASE_APP_ID` | Firebase app ID for the web client. |

You can copy these values from the Firebase Console under **Project settings → General → Your apps → Firebase SDK snippet**. See the Firebase docs for details: [Add Firebase to your JavaScript project](https://firebase.google.com/docs/web/setup#config-object).

## User profile storage

User profiles are stored in Firestore under the `users` collection keyed by the Firebase UID. The `/api/auth/user` endpoint hydrates the profile by merging Firebase token claims with the Firestore document. Update Firestore directly to persist additional profile fields.


## Deployment

Before deploying to Vercel, ensure the project settings include both sets of Firebase credentials:

- **Client build variables**: add the `VITE_FIREBASE_*` values above so the frontend can initialize Firebase when Vite builds your assets.
- **Server credentials**: add the `FIREBASE_*` variables required by the API so the Firebase Admin SDK can authenticate.

Vercel must have both groups of environment variables configured; otherwise the deployment will fail at build time or when handling authenticated requests.
