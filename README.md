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

## User profile storage

User profiles are stored in Firestore under the `users` collection keyed by the Firebase UID. The `/api/auth/user` endpoint hydrates the profile by merging Firebase token claims with the Firestore document. Update Firestore directly to persist additional profile fields.
