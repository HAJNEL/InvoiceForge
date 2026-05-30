# InvoiceForge Setup Guide

## Firebase Setup
1. Run the `set_up_firebase` tool in AI Studio.
2. Accept the terms and wait for the configuration to be generated.

## xAI Configuration (Firebase Functions)
To enable AI extraction via xAI (Grok), you need to provide an xAI API key to your Cloud Functions:

1. Obtain an API key from [xAI](https://x.ai/).
2. Use the Firebase CLI to set the secret:
   ```bash
   firebase functions:secrets:set XAI_API_KEY
   ```
   Or if you are using environment config:
   ```bash
   firebase functions:config:set xai.key="YOUR_XAI_API_KEY"
   ```

## OpenAI Configuration (Firebase Functions)
To enable AI extraction, you need to provide an OpenAI API key to your Cloud Functions:

1. Obtain an API key from [OpenAI](https://platform.openai.com/).
2. Use the Firebase CLI to set the secret:
   ```bash
   firebase functions:secrets:set OPENAI_API_KEY
   ```
   Or if you are using environment config:
   ```bash
   firebase functions:config:set openai.key="YOUR_OPENAI_API_KEY"
   ```

## Local Development
1. `npm install` in the root directory.
2. `npm run dev` to start the frontend.

## Deployment
1. Build the app: `npm run build`
2. Deploy to Firebase:
   ```bash
   firebase deploy
   ```
