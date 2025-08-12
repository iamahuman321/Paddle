const CACHE_NAME = 'padel-tournament-manager-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/leaderboard.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css'
];

// Install event - cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Background sync for offline tournament data
self.addEventListener('sync', event => {
  if (event.tag === 'sync-tournament-data') {
    event.waitUntil(syncTournamentData());
  }
});

// Push notifications
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'New tournament update available!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  event.waitUntil(
    self.registration.showNotification('Padel Tournament Manager', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});

// Helper function to sync tournament data
async function syncTournamentData() {
  try {
    const tournaments = await getLocalTournaments();
    if (tournaments.length > 0) {
      // Sync with server if online
      const response = await fetch('/api/sync', {
        method: 'POST',
        body: JSON.stringify(tournaments),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        console.log('Tournament data synced successfully');
      }
    }
  } catch (error) {
    console.error('Sync failed:', error);
  }
}

// Helper function to get local tournaments
async function getLocalTournaments() {
  return new Promise((resolve) => {
    const dbRequest = indexedDB.open('PadelTournamentDB', 1);
    dbRequest.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['tournaments'], 'readonly');
      const store = transaction.objectStore('tournaments');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
    };
    dbRequest.onerror = () => resolve([]);
  });
}

// Precache strategy for dynamic content
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
