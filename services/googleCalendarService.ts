import { CalendarEvent } from '../types';
import { generateId } from '../utils';

// NOTE: In a production application, these values should be configured in your Google Cloud Console
// and provided here. For this demo, if CLIENT_ID is empty, we will simulate the sync behavior.
const CLIENT_ID = ''; 
const API_KEY = ''; 
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/calendar.events.readonly';

let tokenClient: any;
let gapiInited = false;
let gisInited = false;

export const initializeGoogleCalendar = (
  onGapiLoaded: () => void,
  onGsiLoaded: () => void
) => {
  // Check if scripts are already loaded. Only init if API_KEY is present for gapi.
  if (typeof (window as any).gapi !== 'undefined' && API_KEY) {
    (window as any).gapi.load('client', async () => {
      try {
        await (window as any).gapi.client.init({
          apiKey: API_KEY,
          discoveryDocs: [DISCOVERY_DOC],
        });
        gapiInited = true;
        onGapiLoaded();
      } catch (error) {
        console.warn("GAPI init failed:", error);
      }
    });
  }

  // Only init token client if CLIENT_ID is present
  if (typeof (window as any).google !== 'undefined' && CLIENT_ID) {
    try {
      tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '', // defined later
      });
      gisInited = true;
      onGsiLoaded();
    } catch (error) {
      console.warn("Google Identity init failed:", error);
    }
  }
};

export const handleAuthClick = async (): Promise<CalendarEvent[]> => {
  // FALLBACK: If no Client ID is provided OR tokenClient wasn't initialized
  if (!CLIENT_ID || !tokenClient) {
    console.warn("No Google Client ID configured or Token Client not initialized. Switching to Demo Mode.");
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(getMockGoogleEvents());
      }, 1500);
    });
  }

  // REAL FLOW
  return new Promise((resolve, reject) => {
    tokenClient.callback = async (resp: any) => {
      if (resp.error) {
        reject(resp);
        return;
      }
      
      try {
        const response = await (window as any).gapi.client.calendar.events.list({
          'calendarId': 'primary',
          'timeMin': (new Date()).toISOString(),
          'showDeleted': false,
          'singleEvents': true,
          'maxResults': 100,
          'orderBy': 'startTime'
        });

        const events = response.result.items.map((item: any) => ({
          id: item.id || generateId(),
          title: item.summary || 'No Title',
          start: new Date(item.start.dateTime || item.start.date),
          end: new Date(item.end.dateTime || item.end.date),
          description: item.description,
          location: item.location,
          type: 'google-calendar',
          color: 'bg-red-50 text-red-700 border-red-200',
          source: 'google'
        }));

        resolve(events);
      } catch (err) {
        reject(err);
      }
    };

    if ((window as any).gapi.client.getToken() === null) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      tokenClient.requestAccessToken({ prompt: '' });
    }
  });
};

// Generate realistic mock data for demo purposes
const getMockGoogleEvents = (): CalendarEvent[] => {
  const now = new Date();
  const events: CalendarEvent[] = [];
  
  // Create some events for today and tomorrow
  events.push({
    id: generateId(),
    title: 'Google カレンダー: チーム定例',
    start: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 30),
    end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 30),
    type: 'google-calendar',
    color: 'bg-red-50 text-red-700 border-red-200',
    source: 'google',
    description: '外部カレンダーから同期されました'
  });

  events.push({
    id: generateId(),
    title: 'Google カレンダー: 歯科検診',
    start: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 15, 0),
    end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 16, 0),
    type: 'google-calendar',
    color: 'bg-red-50 text-red-700 border-red-200',
    source: 'google'
  });

   events.push({
    id: generateId(),
    title: 'Google カレンダー: フライト',
    start: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 10, 0),
    end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 13, 0),
    type: 'google-calendar',
    color: 'bg-red-50 text-red-700 border-red-200',
    source: 'google'
  });

  return events;
};