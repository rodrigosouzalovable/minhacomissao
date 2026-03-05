

## Plan: Show disconnected WhatsApp instance alerts

### Problem
When a WhatsApp instance is disconnected (503 errors from UAZAPI), the user only sees generic error toasts. There's no persistent visual indicator showing which specific phones are disconnected.

### Solution

**1. Add connection status check on page load and in the instances list**

When the Acionamento page loads and instances are fetched, automatically test each active instance's connection status using the existing `test-uazapi-connection` edge function. Store the connection status per instance.

**2. Update `src/pages/Acionamento.tsx`:**
- Add a `connectionStatus` state: `Record<string, 'connected' | 'disconnected' | 'checking'>` keyed by instance ID
- After fetching instances, run `test-uazapi-connection` for each active instance in parallel
- In the instances list, show a red/green dot indicator next to each instance name
- If any instance is disconnected, show a persistent alert banner at the top of the page (using the Alert component) listing disconnected phones by name

**3. Update `src/hooks/useAutoSend.tsx`:**
- When a send fails with a message containing "disconnected" or status 503, include the instance name in the error toast with a clear message like: `WhatsApp "Daniela 1" está desconectado. Reconecte o aparelho.`

**4. Visual indicators in the instances list:**
- Green dot + "Conectado" badge for connected instances
- Red dot + "Desconectado" badge for disconnected instances  
- Spinning loader while checking

**5. Alert banner when disconnected instances are detected:**
- A destructive Alert at the top of the Acionamento page listing all disconnected instance names
- Example: "⚠ WhatsApp desconectado: Daniela 1, Daniela 3. Reconecte os aparelhos no painel UAZAPI."

### Files to modify
- `src/pages/Acionamento.tsx` — add status checking logic, alert banner, and status indicators in instance list
- `src/hooks/useAutoSend.tsx` — improve error messages to mention disconnection specifically

