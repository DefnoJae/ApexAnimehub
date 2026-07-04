# MAL-Sync Integration Guide for ApexAnimehub

## Complete Setup Instructions

### Step 1: Get API Credentials (5 minutes)

**MyAnimeList:**
1. Go to https://myanimelist.net/apiconfig/references/authorization
2. Click "Create ID"
3. Fill in:
   - App Name: "ApexAnimehub"
   - App Type: "web app"
   - Redirect URI: `http://localhost:3000/oauth/mal`
4. Copy your **Client ID** (NO secret key needed for MAL)

**AniList:**
1. Go to https://anilist.co/settings/developer
2. Click "Create New CLIENT"
3. Fill in:
   - Name: "ApexAnimehub"
   - Redirect URI: `http://localhost:3000/oauth/anilist`
4. Copy **Client ID** and **Client Secret**

**Kitsu:**
- No credentials needed! Uses email/password auth directly.

### Step 2: Setup Environment Variables

1. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

2. Fill in your credentials in `.env.local`:
   ```
   REACT_APP_MAL_CLIENT_ID=your_client_id_here
   REACT_APP_ANILIST_CLIENT_ID=your_anilist_client_id
   REACT_APP_ANILIST_CLIENT_SECRET=your_anilist_client_secret
   ```

### Step 3: Create OAuth Callback Page

Create file `src/pages/OAuthCallback.tsx`:

```typescript
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { malClient } from '@/utils/sync/malClient';
import { aniListClient } from '@/utils/sync/aniListClient';
import { useSyncSettings } from '@/hooks/useSyncSettings';

export function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const { addProvider } = useSyncSettings();

  useEffect(() => {
    const provider = searchParams.get('provider');
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      alert(`OAuth error: ${error}`);
      window.location.href = '/';
      return;
    }

    if (!provider || !code) {
      window.location.href = '/';
      return;
    }

    if (provider === 'mal') {
      malClient.authenticate(code).then((success) => {
        if (success) {
          addProvider({
            id: 'mal',
            name: 'MyAnimeList',
            authUrl: 'https://myanimelist.net',
            accessToken: 'authenticated',
          });
          alert('✓ MyAnimeList connected!');
        } else {
          alert('✗ Failed to connect MyAnimeList');
        }
        window.location.href = '/';
      });
    } else if (provider === 'anilist') {
      aniListClient.authenticate(code).then((success) => {
        if (success) {
          addProvider({
            id: 'anilist',
            name: 'AniList',
            authUrl: 'https://anilist.co',
            accessToken: 'authenticated',
          });
          alert('✓ AniList connected!');
        } else {
          alert('✗ Failed to connect AniList');
        }
        window.location.href = '/';
      });
    }
  }, [searchParams, addProvider]);

  return (
    <div className="flex items-center justify-center h-screen bg-[#050505]">
      <p className="text-white text-lg">Authenticating...</p>
    </div>
  );
}
```

### Step 4: Add Routes to Your App

In your router setup (or modify `index.tsx` if using React Router):

```typescript
import { OAuthCallback } from '@/pages/OAuthCallback';

// Add these routes:
<Route path="/oauth/mal" element={<OAuthCallback />} />
<Route path="/oauth/anilist" element={<OAuthCallback />} />
```

### Step 5: Integrate Sync into App.tsx

Add these imports at the top of `App.tsx`:

```typescript
import { useSyncSettings } from '@/hooks/useSyncSettings';
import { SyncManager } from '@/utils/sync/syncManager';
```

Add inside your App component (after other state declarations):

```typescript
const { settings } = useSyncSettings();
```

Modify your `changeEpisode` function to add sync:

```typescript
const changeEpisode = async (direction: "next" | "prev") => {
  const newEp = direction === "next" ? activeEpisode + 1 : activeEpisode - 1;
  setActiveEpisode(newEp);
  resolveStreams(selectedAnime, newEp);

  const isDub = playingStream?.name?.includes("Dub");
  const streamName = isDub ? "MegaPlay (Dub)" : "MegaPlay (Sub)";
  setPlayingStream({
    name: streamName,
    url: `https://megaplay.buzz/stream/ani/${selectedAnime.id}/${newEp}/${
      isDub ? "dub" : "sub"
    }?color=${THEME_COLOR}`,
    isEmbed: true,
  });
  
  // ============ ADD THIS SECTION ============
  if (settings.autoSync && settings.syncOnPause) {
    const syncManager = new SyncManager(settings);
    await syncManager.syncEpisodeProgress(
      {
        id: selectedAnime.id,
        title: getDisplayTitle(selectedAnime),
        episodes: totalEpisodes,
        coverImage: selectedAnime.coverImage?.extraLarge,
      },
      newEp,
      totalEpisodes,
      selectedAnime.id,
      selectedAnime.id,
      String(selectedAnime.id)
    );
  }
  // ==========================================
  
  updateHistory(selectedAnime, newEp, streamName);
};
```

### Step 6: Create Settings Component (Optional but Recommended)

Create `src/components/SyncSettingsPanel.tsx`:

```typescript
import { useState } from 'react';
import { useSyncSettings } from '@/hooks/useSyncSettings';
import { malClient } from '@/utils/sync/malClient';
import { aniListClient } from '@/utils/sync/aniListClient';
import { kitsuClient } from '@/utils/sync/kitsuClient';

export function SyncSettingsPanel() {
  const {
    settings,
    loading,
    addProvider,
    removeProvider,
    toggleAutoSync,
  } = useSyncSettings();
  const [kitsuEmail, setKitsuEmail] = useState('');
  const [kitsuPassword, setKitsuPassword] = useState('');

  if (loading) return <p>Loading...</p>;

  const handleMALAuth = () => {
    const authUrl = malClient.getAuthorizationUrl();
    const urlWithProvider = authUrl + '&state=' + encodeURIComponent(JSON.stringify({ provider: 'mal' }));
    window.open(authUrl, 'mal-auth', 'width=600,height=500');
  };

  const handleAniListAuth = () => {
    const authUrl = aniListClient.getAuthorizationUrl();
    window.open(authUrl, 'anilist-auth', 'width=600,height=500');
  };

  const handleKitsuAuth = async () => {
    if (!kitsuEmail || !kitsuPassword) {
      alert('Please enter your Kitsu email and password');
      return;
    }

    const success = await kitsuClient.authenticate(kitsuEmail, kitsuPassword);

    if (success) {
      addProvider({
        id: 'kitsu',
        name: 'Kitsu',
        authUrl: 'https://kitsu.io',
        accessToken: 'authenticated',
      });
      setKitsuEmail('');
      setKitsuPassword('');
      alert('✓ Kitsu connected!');
    } else {
      alert('✗ Kitsu authentication failed');
    }
  };

  return (
    <div className="p-6 bg-[#1a1a1a] rounded-lg border border-white/10">
      <h2 className="text-2xl font-bold text-white mb-4">Anime List Sync</h2>

      <div className="space-y-4 mb-6">
        {/* MyAnimeList */}
        <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
          <div>
            <p className="font-bold text-white">MyAnimeList</p>
            <p className="text-sm text-gray-400">
              {settings.providers['mal'] ? '✓ Connected' : 'Not connected'}
            </p>
          </div>
          {settings.providers['mal'] ? (
            <button
              onClick={() => {
                malClient.logout();
                removeProvider('mal');
              }}
              className="px-4 py-2 bg-red-600 text-white rounded"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={handleMALAuth}
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              Connect
            </button>
          )}
        </div>

        {/* AniList */}
        <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
          <div>
            <p className="font-bold text-white">AniList</p>
            <p className="text-sm text-gray-400">
              {settings.providers['anilist'] ? '✓ Connected' : 'Not connected'}
            </p>
          </div>
          {settings.providers['anilist'] ? (
            <button
              onClick={() => {
                aniListClient.logout();
                removeProvider('anilist');
              }}
              className="px-4 py-2 bg-red-600 text-white rounded"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={handleAniListAuth}
              className="px-4 py-2 bg-purple-600 text-white rounded"
            >
              Connect
            </button>
          )}
        </div>

        {/* Kitsu */}
        <div className="p-4 bg-white/5 rounded-lg">
          <p className="font-bold text-white mb-3">Kitsu</p>
          {settings.providers['kitsu'] ? (
            <button
              onClick={() => {
                kitsuClient.logout();
                removeProvider('kitsu');
              }}
              className="w-full px-4 py-2 bg-red-600 text-white rounded"
            >
              Disconnect
            </button>
          ) : (
            <div className="space-y-2">
              <input
                type="email"
                placeholder="Email"
                value={kitsuEmail}
                onChange={(e) => setKitsuEmail(e.target.value)}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white"
              />
              <input
                type="password"
                placeholder="Password"
                value={kitsuPassword}
                onChange={(e) => setKitsuPassword(e.target.value)}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white"
              />
              <button
                onClick={handleKitsuAuth}
                className="w-full px-4 py-2 bg-orange-600 text-white rounded"
              >
                Connect Kitsu
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Auto Sync Toggle */}
      <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
        <p className="font-bold text-white">Auto Sync Episodes</p>
        <button
          onClick={toggleAutoSync}
          className={`px-4 py-2 rounded ${
            settings.autoSync
              ? 'bg-green-600 text-white'
              : 'bg-gray-600 text-white'
          }`}
        >
          {settings.autoSync ? 'Enabled' : 'Disabled'}
        </button>
      </div>
    </div>
  );
}
```

### Step 7: Test It!

1. Start your app:
   ```bash
   npm start
   ```

2. Test the sync:
   - Click Settings (⚙️) icon
   - Click "Connect" for MyAnimeList or AniList
   - Complete the OAuth flow
   - Play an episode
   - Watch to the next episode or pause
   - Check your MyAnimeList/AniList - episode should be updated!

## Troubleshooting

### OAuth Redirect Issues
- Make sure redirect URIs match EXACTLY
- Check `.env.local` values
- Clear browser cache and try again

### Sync Not Working
1. Open browser DevTools (F12)
2. Check Console for errors
3. Verify you're logged in to the service
4. Check that anime has a valid ID

### CORS Errors
- AniList and Kitsu should work fine
- If you get CORS errors with MAL, check your MAL Client ID is correct

## API Documentation

- MyAnimeList: https://myanimelist.net/apiconfig/references/authorization
- AniList: https://anilist.gitbook.io/anilist-apiv2-docs/
- Kitsu: https://kitsu.docs.apiary.io/

## Files Created

- `src/types/sync.ts` - TypeScript interfaces
- `src/utils/sync/malClient.ts` - MyAnimeList API client
- `src/utils/sync/aniListClient.ts` - AniList GraphQL client
- `src/utils/sync/kitsuClient.ts` - Kitsu API client
- `src/utils/sync/syncManager.ts` - Unified sync manager
- `src/hooks/useSyncSettings.ts` - Settings management hook
- `.env.local.example` - Environment template

## Next Steps

1. ✅ Copy files to your project
2. ✅ Get API credentials
3. ✅ Setup environment variables
4. ✅ Create OAuth callback page
5. ✅ Add routes
6. ✅ Integrate into App.tsx
7. ✅ Test!

You're all set! Enjoy automatic anime tracking! 🎉
