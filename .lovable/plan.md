

# Fix: Chat history persistence bug

## Problem

The `prevMsgCountRef.current = newCount` line (line 113) runs **unconditionally**, even when `isChatLoading` is `true` and the save is skipped. This causes all messages to be "counted" but never actually inserted into the database.

## Fix

In `src/pages/AutomacaoCobMais.tsx` (lines 108-133), restructure the effect so that:

1. If `isChatLoading` is true, **return early without updating** `prevMsgCountRef`
2. Only update `prevMsgCountRef.current = newCount` **after** the insert succeeds

```tsx
useEffect(() => {
  if (!chatLoaded || isChatLoading || chatMessages.length === 0) return;
  const newCount = chatMessages.length;
  const prevCount = prevMsgCountRef.current;
  if (newCount <= prevCount) return;
  const newMsgs = chatMessages.slice(prevCount);
  prevMsgCountRef.current = newCount; // only reached when not loading
  const saveNew = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const rows = newMsgs
      .filter(m => typeof m.content === 'string' ? m.content.trim() : true)
      .map(m => ({
        user_id: user.id,
        role: m.role,
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        image: m.image || null,
      }));
    if (rows.length > 0) {
      await supabase.from('chat_ia_mensagens').insert(rows as any);
    }
  };
  saveNew();
}, [chatMessages, chatLoaded, isChatLoading]);
```

The key change: move the `isChatLoading` check to the **early return** at the top, so neither `prevMsgCountRef` nor the save runs while streaming. When streaming finishes and `isChatLoading` becomes `false`, the effect re-runs and correctly detects all new messages (user + assistant) and saves them in one batch.

Single file change, ~5 lines modified.

