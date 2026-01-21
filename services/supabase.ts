import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ogjydrxxglkgvocqywzb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nanlkcnh4Z2xrZ3ZvY3F5d3piIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NTc3MTgsImV4cCI6MjA4MjQzMzcxOH0.FhhBvTZYuAn8jiWeDU7jqZze5lH3cJc-8unwvG0ZwGU';

const client = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false, // STOP THE LOOP
        persistSession: true,
        detectSessionInUrl: false
    }
});

// @ts-ignore
console.log("Supabase Client Initialized with config:", client.auth.autoRefreshToken ? "AutoRefresh ON" : "AutoRefresh OFF");

export const supabase = client;

// [GOD MODE FIX] Global Fetch Interceptor
// We intercept the actual network request to Supabase's token endpoint.
const originalFetch = window.fetch;
let lastTokenRefreshTime = 0;

// Helper to find the correct key dynamically
const findSupabaseSessionKey = () => {
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
                return key;
            }
        }
    } catch (e) {
        console.error("[Network Firewall] Error searching localStorage:", e);
    }
    return null;
};

window.fetch = async (...args) => {
    const [resource, config] = args;
    const url = typeof resource === 'string' ? resource : resource instanceof Request ? resource.url : '';

    // Check if this is a Token Refresh request
    if (url.includes('/auth/v1/token') && url.includes('grant_type=refresh_token')) {
        const now = Date.now();
        if (now - lastTokenRefreshTime < 5000) { // 5 Second Firewall
            console.warn(`[Network Firewall] BLOCKED Rapid Token Refresh Request to: ${url}`);

            // ATTEMPT TO RECYCLE EXISTING TOKEN
            let mockResponse = null;

            try {
                const storageKey = findSupabaseSessionKey();
                if (storageKey) {
                    const storedSession = localStorage.getItem(storageKey);
                    if (storedSession) {
                        const session = JSON.parse(storedSession);
                        if (session.access_token && session.refresh_token) {
                            console.log(`[Network Firewall] Recycling existing valid token from key: ${storageKey}`);
                            mockResponse = {
                                access_token: session.access_token,
                                refresh_token: session.refresh_token,
                                expires_in: 3600,
                                token_type: "bearer",
                                user: session.user
                            };
                        }
                    }
                } else {
                    console.warn("[Network Firewall] No Supabase token found in localStorage to recycle.");
                    // List keys for debugging
                    console.log("Available keys:", Object.keys(localStorage));
                }
            } catch (e) {
                console.error("[Network Firewall] Failed to recycle token:", e);
            }

            if (mockResponse) {
                return new Response(JSON.stringify(mockResponse), {
                    status: 200,
                    statusText: "OK",
                    headers: { 'Content-Type': 'application/json' }
                });
            } else {
                console.warn("[Network Firewall] Could not recycle token. Returning 429 to force backoff (instead of dummy data).");
                return new Response(JSON.stringify({ error: "Too Many Requests (Client Blocked)" }), {
                    status: 429,
                    statusText: "Too Many Requests",
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }
        lastTokenRefreshTime = now;
        console.log(`[Network Firewall] Allowing Token Refresh Request`);
    }

    return originalFetch(...args);
};
