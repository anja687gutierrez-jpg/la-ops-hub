// ═══════════════════════════════════════════════════════════════════════════════
// CARRIER TRACKING API — Cloudflare Pages Function
// GET /api/track?carrier=fedex&number=123456789012
// Returns normalized: { status, deliveredDate, lastUpdate, location }
// ═══════════════════════════════════════════════════════════════════════════════

// In-memory OAuth token cache (survives within a single isolate, ~5 min lifespan on CF)
const tokenCache = new Map();

function cachedToken(key) {
    const entry = tokenCache.get(key);
    if (entry && Date.now() < entry.expiresAt) return entry.token;
    tokenCache.delete(key);
    return null;
}

function storeToken(key, token, ttlSeconds) {
    // Shave 5 min off TTL for safety margin
    const expiresAt = Date.now() + (ttlSeconds - 300) * 1000;
    tokenCache.set(key, { token, expiresAt });
}

// Normalize carrier status strings to our four canonical statuses
function normalizeStatus(raw) {
    const s = (raw || '').toLowerCase();
    if (s.includes('deliver')) return 'Delivered';
    if (s.includes('transit') || s.includes('movement') || s.includes('departed') || s.includes('arrived') || s.includes('processing') || s.includes('out for delivery')) return 'In Transit';
    if (s.includes('ship') || s.includes('picked up') || s.includes('accepted') || s.includes('origin')) return 'Shipped';
    return 'Pending';
}

// ── DHL ─────────────────────────────────────────────────────────────────────
async function trackDHL(number, env) {
    const apiKey = env.DHL_API_KEY;
    if (!apiKey) return { configured: false };

    const res = await fetch(
        `https://api-eu.dhl.com/track/shipments?trackingNumber=${encodeURIComponent(number)}`,
        { headers: { 'DHL-API-Key': apiKey } }
    );
    if (res.status === 404) return { error: 'Tracking number not found', status: 404 };
    if (!res.ok) return { error: `DHL API error: ${res.status}`, status: 502 };

    const data = await res.json();
    const shipment = data.shipments?.[0];
    if (!shipment) return { error: 'Tracking number not found', status: 404 };

    const lastEvent = shipment.events?.[0];
    const delivered = shipment.status?.statusCode === 'delivered';

    return {
        status: delivered ? 'Delivered' : normalizeStatus(shipment.status?.status),
        deliveredDate: delivered && lastEvent?.timestamp ? lastEvent.timestamp.split('T')[0] : null,
        lastUpdate: lastEvent?.timestamp || null,
        location: lastEvent?.location?.address?.addressLocality || null,
    };
}

// ── FedEx ───────────────────────────────────────────────────────────────────
async function getFedExToken(env) {
    const cached = cachedToken('fedex');
    if (cached) return cached;

    const res = await fetch('https://apis.fedex.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: env.FEDEX_CLIENT_ID,
            client_secret: env.FEDEX_CLIENT_SECRET,
        }),
    });
    if (!res.ok) throw new Error(`FedEx OAuth failed: ${res.status}`);
    const data = await res.json();
    storeToken('fedex', data.access_token, data.expires_in || 3600);
    return data.access_token;
}

async function trackFedEx(number, env) {
    if (!env.FEDEX_CLIENT_ID || !env.FEDEX_CLIENT_SECRET) return { configured: false };

    const token = await getFedExToken(env);
    const res = await fetch('https://apis.fedex.com/track/v1/trackingnumbers', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
            trackingInfo: [{ trackingNumberInfo: { trackingNumber: number } }],
            includeDetailedScans: false,
        }),
    });
    if (!res.ok) return { error: `FedEx API error: ${res.status}`, status: 502 };

    const data = await res.json();
    const result = data.output?.completeTrackResults?.[0]?.trackResults?.[0];
    if (!result || result.error) return { error: 'Tracking number not found', status: 404 };

    const latestStatus = result.latestStatusDetail;
    const delivered = latestStatus?.code === 'DL';
    const scanEvent = result.scanEvents?.[0];

    return {
        status: delivered ? 'Delivered' : normalizeStatus(latestStatus?.description),
        deliveredDate: delivered && result.dateAndTimes?.find(d => d.type === 'ACTUAL_DELIVERY')?.dateTime?.split('T')[0] || null,
        lastUpdate: scanEvent?.date || null,
        location: scanEvent?.scanLocation ? `${scanEvent.scanLocation.city}, ${scanEvent.scanLocation.stateOrProvinceCode}` : null,
    };
}

// ── USPS ────────────────────────────────────────────────────────────────────
async function getUSPSToken(env) {
    const cached = cachedToken('usps');
    if (cached) return cached;

    const res = await fetch('https://api.usps.com/oauth2/v3/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: env.USPS_CLIENT_ID,
            client_secret: env.USPS_CLIENT_SECRET,
        }),
    });
    if (!res.ok) throw new Error(`USPS OAuth failed: ${res.status}`);
    const data = await res.json();
    storeToken('usps', data.access_token, data.expires_in || 3600);
    return data.access_token;
}

async function trackUSPS(number, env) {
    if (!env.USPS_CLIENT_ID || !env.USPS_CLIENT_SECRET) return { configured: false };

    const token = await getUSPSToken(env);
    const res = await fetch(
        `https://api.usps.com/tracking/v3/tracking/${encodeURIComponent(number)}?expand=DETAIL`,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.status === 404) return { error: 'Tracking number not found', status: 404 };
    if (!res.ok) return { error: `USPS API error: ${res.status}`, status: 502 };

    const data = await res.json();
    const tracking = data.trackingNumber ? data : data.trackResponse?.trackInfo?.[0];
    if (!tracking) return { error: 'Tracking number not found', status: 404 };

    const delivered = (tracking.statusCategory || '').toLowerCase().includes('deliver');
    const lastEvent = tracking.trackingEvents?.[0];

    return {
        status: delivered ? 'Delivered' : normalizeStatus(tracking.statusCategory || tracking.status),
        deliveredDate: delivered && tracking.actualDeliveryDate ? tracking.actualDeliveryDate.split('T')[0] : null,
        lastUpdate: lastEvent?.eventTimestamp || tracking.lastUpdated || null,
        location: lastEvent ? `${lastEvent.eventCity || ''}, ${lastEvent.eventState || ''}`.replace(/^, |, $/, '') : null,
    };
}

// ── UPS ─────────────────────────────────────────────────────────────────────
async function getUPSToken(env) {
    const cached = cachedToken('ups');
    if (cached) return cached;

    const res = await fetch('https://onlinetools.ups.com/security/v1/oauth/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: 'Basic ' + btoa(`${env.UPS_CLIENT_ID}:${env.UPS_CLIENT_SECRET}`),
        },
        body: new URLSearchParams({ grant_type: 'client_credentials' }),
    });
    if (!res.ok) throw new Error(`UPS OAuth failed: ${res.status}`);
    const data = await res.json();
    storeToken('ups', data.access_token, data.expires_in || 14400);
    return data.access_token;
}

async function trackUPS(number, env) {
    if (!env.UPS_CLIENT_ID || !env.UPS_CLIENT_SECRET) return { configured: false };

    const token = await getUPSToken(env);
    const res = await fetch(
        `https://onlinetools.ups.com/api/track/v1/details/${encodeURIComponent(number)}`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
                transId: `ops-hub-${Date.now()}`,
                transactionSrc: 'ops-hub-portal',
            },
        }
    );
    if (res.status === 404) return { error: 'Tracking number not found', status: 404 };
    if (!res.ok) return { error: `UPS API error: ${res.status}`, status: 502 };

    const data = await res.json();
    const pkg = data.trackResponse?.shipment?.[0]?.package?.[0];
    if (!pkg) return { error: 'Tracking number not found', status: 404 };

    const currentStatus = pkg.currentStatus;
    const delivered = currentStatus?.code === '011';
    const activity = pkg.activity?.[0];

    return {
        status: delivered ? 'Delivered' : normalizeStatus(currentStatus?.description),
        deliveredDate: delivered && activity?.date ? `${activity.date.slice(0, 4)}-${activity.date.slice(4, 6)}-${activity.date.slice(6, 8)}` : null,
        lastUpdate: activity?.date && activity?.time ? new Date(`${activity.date.slice(0, 4)}-${activity.date.slice(4, 6)}-${activity.date.slice(6, 8)}T${activity.time.slice(0, 2)}:${activity.time.slice(2, 4)}:${activity.time.slice(4, 6)}Z`).toISOString() : null,
        location: activity?.location?.address ? `${activity.location.address.city}, ${activity.location.address.stateProvince}` : null,
    };
}

// ── Route handler ───────────────────────────────────────────────────────────
const CARRIER_HANDLERS = {
    dhl: trackDHL,
    fedex: trackFedEx,
    usps: trackUSPS,
    ups: trackUPS,
};

export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const carrier = (url.searchParams.get('carrier') || '').toLowerCase();
    const number = url.searchParams.get('number') || '';

    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
    };

    if (!carrier || !number) {
        return new Response(JSON.stringify({ error: 'Missing carrier or number parameter' }), { status: 400, headers });
    }

    const handler = CARRIER_HANDLERS[carrier];
    if (!handler) {
        return new Response(JSON.stringify({ error: `Unknown carrier: ${carrier}` }), { status: 400, headers });
    }

    try {
        const result = await handler(number, env);

        if (result.configured === false) {
            return new Response(JSON.stringify({ error: 'Carrier not configured' }), { status: 501, headers });
        }
        if (result.error) {
            return new Response(JSON.stringify({ error: result.error }), { status: result.status || 502, headers });
        }

        return new Response(JSON.stringify(result), { status: 200, headers });
    } catch (err) {
        return new Response(JSON.stringify({ error: `Tracking failed: ${err.message}` }), { status: 502, headers });
    }
}
