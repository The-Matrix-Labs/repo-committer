# Google Sheets Integration Setup Guide

This guide will help you integrate Google Sheets with your MongoDB data to automatically sync cart information.

## Prerequisites

-   A Google Cloud project with the Google Sheets API enabled
-   A Google Service Account with credentials
-   A Google Spreadsheet

## Step 1: Create a Google Cloud Project and Enable Google Sheets API

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Sheets API:
    - Go to "APIs & Services" > "Library"
    - Search for "Google Sheets API"
    - Click "Enable"

## Step 2: Create a Service Account

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "Service Account"
3. Fill in the service account details and click "Create"
4. Skip the optional steps and click "Done"
5. Click on the created service account
6. Go to the "Keys" tab
7. Click "Add Key" > "Create new key"
8. Select "JSON" format and click "Create"
9. Save the downloaded JSON file securely

## Step 3: Create a Google Spreadsheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet
3. Copy the spreadsheet ID from the URL:
    - URL format: `https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit`
4. Share the spreadsheet with the service account email:
    - Click "Share" button
    - Add the service account email (found in the JSON file as `client_email`)
    - Give it "Editor" permissions

## Step 4: Configure Environment Variables

Add the following to your `.env` file:

```env
# Google Sheets Integration (Optional)
GOOGLE_SHEETS_CREDENTIALS={"type":"service_account","project_id":"...","private_key_id":"...","private_key":"...","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id_here
```

**Important:**

-   `GOOGLE_SHEETS_CREDENTIALS`: Paste the entire content of the downloaded JSON file as a single-line string
-   `GOOGLE_SHEETS_SPREADSHEET_ID`: The ID from your spreadsheet URL

## Step 5: Restart Your Server

After adding the environment variables, restart your server:

```bash
npm run dev
```

If configured correctly, you should see:

```
📊 Google Sheets integration enabled
📊 Spreadsheet URL: https://docs.google.com/spreadsheets/d/YOUR_SPREADSHEET_ID/edit
```

## Usage

### Real-time Sync

Individual cart operations sync immediately to Google Sheets:

-   Creating/updating carts (real-time)
-   Updating cart status (real-time)
-   Adding notes (real-time)

### View Spreadsheet URL

**Endpoint:** `GET /sheets/url`

```bash
curl http://localhost:3000/sheets/url
```

**Response:**

```json
{
    "success": true,
    "url": "https://docs.google.com/spreadsheets/d/YOUR_SPREADSHEET_ID/edit"
}
```

## Spreadsheet Structure

The Google Sheet will have the following columns:

| Column         | Description                                                     |
| -------------- | --------------------------------------------------------------- |
| Cart ID        | Unique cart identifier                                          |
| Status         | Not Contacted / Called and Converted / Called but Not Converted |
| Notes          | Agent notes                                                     |
| Latest Stage   | Current cart stage                                              |
| First Name     | Customer first name                                             |
| Last Name      | Customer last name                                              |
| Email          | Customer email                                                  |
| Phone Number   | Customer phone                                                  |
| Phone Verified | Yes/No                                                          |
| Item Names     | Comma-separated item names                                      |
| Item Prices    | Comma-separated item prices                                     |
| Shipping Price | Shipping cost                                                   |
| RTO Predict    | RTO prediction                                                  |
| Total Price    | Total cart value                                                |
| Tax            | Tax amount                                                      |
| Payment Status | Payment status                                                  |
| Created At     | Cart creation timestamp                                         |
| Updated At     | Last update timestamp                                           |

## Troubleshooting

### "Google Sheets integration is not configured"

Make sure:

-   Environment variables are set correctly
-   The JSON credentials are valid
-   The spreadsheet ID is correct

### "Permission denied" errors

Ensure:

-   The service account email has been added to the spreadsheet with Editor permissions
-   The Google Sheets API is enabled in your Google Cloud project

### Sync not working automatically

Check:

-   Server logs for any errors
-   The service account has proper permissions
-   The credentials JSON is properly formatted (no extra spaces or newlines)

## Optional: Disable Google Sheets Integration

If you want to disable Google Sheets integration, simply remove or comment out the environment variables:

```env
# GOOGLE_SHEETS_CREDENTIALS=...
# GOOGLE_SHEETS_SPREADSHEET_ID=...
```

The application will continue to work normally, saving data only to MongoDB.
