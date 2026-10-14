# Full export through the built-in tool

No code changes. You export everything yourself, with no setup needed from me.

## Steps
1. Open **Cloud → Advanced settings → Export data** and download the full export file.
2. On your new server, load that file with the database's standard restore command. The data must go in after the structure (tables, types and functions).
3. Server functions are not included in the database file. They are already in the project's `supabase/functions` folder, so publish them to the new server from there.
4. Add the private keys again on the new server (Meta, UAZAPI, Casa dos Dados, Google Maps and the rest). They are never exported.
5. Point the app to the new server's address and key, then test signing in, the Inbox and sending messages.

## Notes
- User passwords and logins move only if the export includes the sign-in data. If it doesn't, users must reset their passwords.
- Uploaded files (media, documents) are stored separately and must be copied on their own.
- Scheduled jobs need to be created again on the new server.
