import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-push-secret",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const secret = Deno.env.get("PUSH_SECRET") ?? "";
    if ((req.headers.get("x-push-secret") ?? "") !== secret || secret === "") {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { clinicId, targetRole, userId, title, body } = await req.json();
    if (!clinicId) {
      return new Response(JSON.stringify({ error: "missing clinicId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // subscriptions with the owner role (admin/super_admin receive everything)
    const { data: subs, error } = await admin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth, profiles!inner(role)")
      .eq("clinic_id", clinicId);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admins = new Set(["admin", "super_admin"]);
    const targets = (subs ?? []).filter((s: any) => {
      const r = s.profiles?.role;
      if (!targetRole || targetRole === "all") return true;
      if (r === targetRole) return true;
      if (admins.has(r)) return true; // المديرون يستلمون كل شيء
      return false;
    });

    webpush.setVapidDetails(
      Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com",
      Deno.env.get("VAPID_PUBLIC_KEY") ?? "",
      Deno.env.get("VAPID_PRIVATE_KEY") ?? ""
    );
    const payload = JSON.stringify({ title: title ?? "إشعار جديد", body: body ?? "" });

    let sent = 0;
    const dead: string[] = [];
    await Promise.all(
      targets.map(async (s: any) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload
          );
          sent++;
        } catch (e: any) {
          if (e?.statusCode === 404 || e?.statusCode === 410) dead.push(s.endpoint);
        }
      })
    );
    for (const endpoint of dead) {
      await admin.from("push_subscriptions").delete().eq("endpoint", endpoint);
    }

    return new Response(JSON.stringify({ sent, dead: dead.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
