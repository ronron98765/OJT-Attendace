# InternTrack — GitHub Pages + Google Sheets

This project is a shared online OJT attendance system. The website can be hosted on GitHub Pages, while all records are stored in Google Sheets through Google Apps Script.

## Files

- `index.html` — main website
- `style.css` — design/layout
- `script.js` — website logic and API connection
- `google-apps-script.gs` — backend code for Google Apps Script

## Step 1 — Create the Google Sheet database

1. Open Google Sheets.
2. Create a blank spreadsheet.
3. Rename it to `InternTrack Database`.
4. Go to **Extensions > Apps Script**.
5. Delete the default code.
6. Copy and paste the contents of `google-apps-script.gs`.
7. Click **Save**.
8. Run the `setup` function once.
9. Allow permissions.

This will create three sheets:

- `Interns`
- `Logs`
- `Tasks`

## Step 2 — Deploy the Apps Script as a Web App

1. In Apps Script, click **Deploy > New deployment**.
2. Select **Web app**.
3. Use these settings:
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Click **Deploy**.
5. Copy the Web App URL.

## Step 3 — Connect the website to the database

1. Open `script.js`.
2. Find this line:

```js
const API_URL = 'PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE';
```

3. Replace the placeholder with your Web App URL.

Example:

```js
const API_URL = 'https://script.google.com/macros/s/AKfycbxxxxxxx/exec';
```

## Step 4 — Test locally

Open `index.html` in your browser. You can also use VS Code Live Server.

Default admin password:

```txt
admin123
```

## Step 5 — Upload to GitHub Pages

1. Create a new GitHub repository.
2. Upload these files:
   - `index.html`
   - `style.css`
   - `script.js`
3. Go to **Settings > Pages**.
4. Under **Build and deployment**, choose:
   - Source: Deploy from branch
   - Branch: main
   - Folder: /root
5. Save.
6. Open your GitHub Pages link.

## Important Notes

- Google Apps Script deployment must be updated if you change `google-apps-script.gs`.
- The website will not save to Google Sheets until you paste the Web App URL into `script.js`.
- This is a simple admin password system for testing. For production, use a stronger authentication method.

## Update in this version
- Intern/OJT dashboard now includes Activity Board, Calendar, and Print DTR.
- Interns can move their assigned tasks between To Do, Doing, and Done.
- Intern view shows only records connected to the Intern ID entered in Check In & Tasks.

## Photo update
This version adds a Profile Image field for each intern. Photos are resized in the browser and saved as a `photo` column in the `Interns` sheet.

After uploading the new website files to GitHub, also replace your Google Apps Script code with the included `google-apps-script.gs`, save it, and deploy a new Web App version. The script will automatically add the `photo` column to your existing `Interns` sheet when data is saved.
