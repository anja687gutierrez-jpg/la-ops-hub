// ═══════════════════════════════════════════════════════════════════════════════
// CARRIER TRACKING API — Cloudflare Pages Function (powered by 17TRACK)
// GET /api/track?number=1Z999AA10123456784&carrier=ups
// Returns normalized: { status, deliveredDate, lastUpdate, location, carrier }
// ═══════════════════════════════════════════════════════════════════════════════

const API_BASE = 'https://api.17track.net/track/v2.2';

const HEADERS_17TRACK = (apiKey) => ({
    'Content-Type': 'application/json',
    '17token': apiKey,
});

const CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
};

// Map 17TRACK status strings to our four canonical statuses
function normalizeStatus(status) {
    switch (status) {
        case 'Delivered': return 'Delivered';
        case 'InTransit':
        case 'OutForDelivery':
        case 'AvailableForPickup': return 'In Transit';
        case 'InfoReceived': return 'Shipped';
        case 'NotFound':
        case 'Expired': return 'Pending';
        case 'DeliveryFailure':
        case 'Exception': return 'In Transit'; // still actionable, not "delivered"
        default: return 'Pending';
    }
}

// Register a tracking number with 17TRACK (costs 1 quota, only needed once)
async function registerNumber(number, apiKey) {
    const res = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: HEADERS_17TRACK(apiKey),
        body: JSON.stringify([{ number }]), // auto-detect carrier
    });
    if (!res.ok) throw new Error(`17TRACK register failed: ${res.status}`);
    return res.json();
}

// Get tracking info (free, unlimited calls after registration)
async function getTrackInfo(number, apiKey) {
    const res = await fetch(`${API_BASE}/gettrackinfo`, {
        method: 'POST',
        headers: HEADERS_17TRACK(apiKey),
        body: JSON.stringify([{ number }]),
    });
    if (!res.ok) throw new Error(`17TRACK gettrackinfo failed: ${res.status}`);
    return res.json();
}

// Small delay helper
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const number = (url.searchParams.get('number') || '').trim();

    if (!number) {
        return new Response(JSON.stringify({ error: 'Missing number parameter' }), { status: 400, headers: CORS_HEADERS });
    }

    const apiKey = env.TRACK17_API_KEY;
    if (!apiKey) {
        return new Response(JSON.stringify({ error: 'Tracking not configured' }), { status: 501, headers: CORS_HEADERS });
    }

    try {
        // Try gettrackinfo first (number may already be registered)
        let data = await getTrackInfo(number, apiKey);
        let item = data?.data?.accepted?.[0];

        // If not found or no track_info, register and retry
        if (!item?.track_info?.latest_status?.status || item.track_info.latest_status.status === 'NotFound') {
            const regResult = await registerNumber(number, apiKey);
            const rejected = regResult?.data?.rejected?.[0];
            if (rejected) {
                return new Response(JSON.stringify({ error: rejected.error?.message || 'Registration failed' }), { status: 404, headers: CORS_HEADERS });
            }
            // Give 17TRACK a moment to fetch from carrier
            await sleep(2000);
            data = await getTrackInfo(number, apiKey);
            item = data?.data?.accepted?.[0];
        }

        if (!item?.track_info) {
            return new Response(JSON.stringify({
                status: 'Pending',
                deliveredDate: null,
                lastUpdate: null,
                location: null,
                carrier: null,
                detail: 'Tracking registered — status will update shortly',
            }), { status: 200, headers: CORS_HEADERS });
        }

        const info = item.track_info;
        const rawStatus = info.latest_status?.status || 'NotFound';
        const status = normalizeStatus(rawStatus);
        const lastEvent = info.latest_event || {};
        const carrierName = info.providers?.[0]?.provider?.name || null;

        return new Response(JSON.stringify({
            status,
            deliveredDate: status === 'Delivered' && lastEvent.time_iso ? lastEvent.time_iso.split('T')[0] : null,
            lastUpdate: lastEvent.time_utc || lastEvent.time_iso || null,
            location: lastEvent.location || null,
            carrier: carrierName,
        }), { status: 200, headers: CORS_HEADERS });

    } catch (err) {
        return new Response(JSON.stringify({ error: `Tracking failed: ${err.message}` }), { status: 502, headers: CORS_HEADERS });
    }
}
