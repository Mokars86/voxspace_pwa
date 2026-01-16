import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts"

// Initialize Firebase Admin (using raw REST API for Deno compatibility without complex npm setup)
// We use a service account JSON which should be in secrets
const FIREBASE_PROJECT_ID = Deno.env.get('FIREBASE_PROJECT_ID')
const FIREBASE_CLIENT_EMAIL = Deno.env.get('FIREBASE_CLIENT_EMAIL')
// Parse the Private Key more robustly to handle common copy-paste errors
let FIREBASE_PRIVATE_KEY = Deno.env.get('FIREBASE_PRIVATE_KEY') ?? '';

// Debug Trace
console.log("Trace: Raw Key Length", FIREBASE_PRIVATE_KEY.length);

// Key Parsing and Cleanup Logic
if (FIREBASE_PRIVATE_KEY) {
    if (FIREBASE_PRIVATE_KEY.trim().startsWith('{')) {
        try {
            const keyJson = JSON.parse(FIREBASE_PRIVATE_KEY);
            if (keyJson.private_key) {
                FIREBASE_PRIVATE_KEY = keyJson.private_key;
            }
        } catch (e) {
            console.error("Trace: Failed to parse JSON key", e);
        }
    }

    if (FIREBASE_PRIVATE_KEY.startsWith('"') && FIREBASE_PRIVATE_KEY.endsWith('"')) {
        FIREBASE_PRIVATE_KEY = FIREBASE_PRIVATE_KEY.slice(1, -1);
    }

    let rawBody = FIREBASE_PRIVATE_KEY;
    const BEGIN_HEADER = "-----BEGIN PRIVATE KEY-----";
    const END_HEADER = "-----END PRIVATE KEY-----";

    if (rawBody.includes(BEGIN_HEADER)) rawBody = rawBody.replace(BEGIN_HEADER, "");
    if (rawBody.includes(END_HEADER)) rawBody = rawBody.replace(END_HEADER, "");

    let cleanBody = rawBody.replace(/\\n/g, "").replace(/\\\\n/g, "");
    cleanBody = cleanBody.replace(/[^A-Za-z0-9+/=]/g, "");

    FIREBASE_PRIVATE_KEY = `${BEGIN_HEADER}\n${cleanBody}\n${END_HEADER}`;
} else {
    console.error("Critical: FIREBASE_PRIVATE_KEY is missing from environment variables.");
}

// CORS Headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const getAccessToken = async () => {
    // ... same as before
    if (!FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
        throw new Error("Missing Firebase Credentials");
    }

    let privateKey;
    try {
        privateKey = await jose.importPKCS8(FIREBASE_PRIVATE_KEY, "RS256");
    } catch (importError) {
        throw new Error(`Failed to import Private Key. Msg: ${importError.message}`);
    }

    const jwt = await new jose.SignJWT({
        iss: FIREBASE_CLIENT_EMAIL,
        sub: FIREBASE_CLIENT_EMAIL,
        aud: "https://oauth2.googleapis.com/token",
        scope: "https://www.googleapis.com/auth/firebase.messaging"
    })
        .setProtectedHeader({ alg: "RS256", typ: "JWT" })
        .setExpirationTime("1h")
        .setIssuedAt()
        .sign(privateKey);

    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion: jwt
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google Token API Error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.access_token;
}

serve(async (req) => {
    // Handle CORS preflight request
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Webhook payload parsing
        const payload = await req.json()

        // Handle Test Mode
        if (payload.type === 'test') {
            const userId = payload.record?.user_id;
            if (!userId) {
                return new Response(JSON.stringify({ error: "Missing user_id for test" }), {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            const { data: profile } = await supabase.from('profiles').select('fcm_token').eq('id', userId).single();
            if (!profile?.fcm_token) {
                return new Response(JSON.stringify({ error: "No token found for user" }), {
                    status: 404,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            const token = profile.fcm_token;
            console.log(`Sending test notification to user ${userId} with token ${token}`);

            const accessToken = await getAccessToken();

            const res = await fetch(`https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({
                    message: {
                        token: token,
                        notification: {
                            title: 'Test Notification',
                            body: payload.record.content || 'Test content',
                        },
                        android: {
                            priority: 'HIGH',
                            notification: {
                                channel_id: 'default',
                                default_sound: true,
                                visibility: 'PUBLIC'
                            }
                        }
                    }
                })
            });

            const result = await res.json();
            return new Response(JSON.stringify(result), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // Handle Trigger Mode
        const { record } = payload
        if (!record || !record.chat_id || !record.sender_id) {
            return new Response("Invalid payload", { status: 400, headers: corsHeaders })
        }

        const chatId = record.chat_id
        const senderId = record.sender_id
        const content = record.content || (record.type === 'image' ? 'Image' : 'New Message')

        // 1. Get Sender Name
        const { data: sender } = await supabase.from('profiles').select('full_name').eq('id', senderId).maybeSingle()
        const senderName = sender?.full_name || 'Someone'

        // 2. Get Recipients
        const { data: participants } = await supabase.from('chat_participants').select('user_id').eq('chat_id', chatId).neq('user_id', senderId)

        if (!participants || participants.length === 0) {
            return new Response("No recipients", { status: 200, headers: corsHeaders })
        }

        const recipientIds = participants.map(p => p.user_id)

        // 3. Get FCM Tokens
        const { data: profiles } = await supabase.from('profiles').select('fcm_token').in('id', recipientIds).not('fcm_token', 'is', null)

        if (!profiles || profiles.length === 0) {
            return new Response("No valid tokens found", { status: 200, headers: corsHeaders })
        }

        const tokens = profiles.map(p => p.fcm_token).filter(t => t)

        if (tokens.length === 0) {
            return new Response("No tokens to send to", { status: 200, headers: corsHeaders })
        }

        // 4. Send Notification
        console.log(`Found ${tokens.length} FCM tokens. Preparing to send...`);
        const accessToken = await getAccessToken();

        const promises = tokens.map(token => {
            return fetch(`https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({
                    message: {
                        token: token,
                        notification: {
                            title: senderName,
                            body: content,
                        },
                        android: {
                            priority: 'HIGH',
                            notification: {
                                channel_id: 'default',
                                default_sound: true,
                                visibility: 'PUBLIC'
                            }
                        },
                        data: {
                            url: `/chat/${chatId}`,
                            chatId: chatId,
                            type: 'new_message'
                        }
                    }
                })
            })
        })

        await Promise.all(promises)

        console.log(`Successfully sent ${tokens.length} notifications.`);
        return new Response(JSON.stringify({ success: true, count: tokens.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })

    } catch (error) {
        console.error("Critical Error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        })
    }
})
