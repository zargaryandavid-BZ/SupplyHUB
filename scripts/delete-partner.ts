import { createClient } from "@supabase/supabase-js";

async function run() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Find BossPrint
  const { data: partners } = await sb
    .from("partners")
    .select("id, company, email")
    .ilike("company", "%bossprint%");

  console.log("Found partners:", partners);

  if (!partners?.length) {
    console.log("No matching partner found.");
    return;
  }

  for (const p of partners) {
    console.log(`\nDeleting partner: ${p.company} (id=${p.id})`);

    // Get all dispatches for this partner
    const { data: dispatches } = await sb
      .from("dispatches")
      .select("id, request_id")
      .eq("partner_id", p.id);

    const dispatchIds = (dispatches ?? []).map((d) => d.id as number);
    const requestIds = [...new Set((dispatches ?? []).map((d) => d.request_id as number))];

    console.log("  dispatches:", dispatchIds);
    console.log("  request_ids:", requestIds);

    // Delete feedback for this partner's dispatches
    if (dispatchIds.length) {
      await sb.from("partner_feedback").delete().in("dispatch_id", dispatchIds);
      console.log("  ✓ cleared partner_feedback");
    }

    // Delete quotes for these dispatches
    if (dispatchIds.length) {
      await sb.from("quotes").delete().in("dispatch_id", dispatchIds);
      console.log("  ✓ cleared quotes");
    }

    // Delete messages for these requests (from this partner)
    if (requestIds.length) {
      await sb.from("messages").delete().eq("partner_id", p.id);
      console.log("  ✓ cleared messages");
    }

    // Delete dispatches for this partner
    await sb.from("dispatches").delete().eq("partner_id", p.id);
    console.log("  ✓ cleared dispatches");

    // For each request: if no other dispatches remain, delete the request too
    for (const rid of requestIds) {
      const { count } = await sb
        .from("dispatches")
        .select("id", { count: "exact", head: true })
        .eq("request_id", rid);

      if ((count ?? 0) === 0) {
        await sb.from("product_requests").delete().eq("id", rid);
        console.log(`  ✓ deleted request #${rid} (no remaining dispatches)`);
      } else {
        console.log(`  ~ request #${rid} kept (still has ${count} other dispatch(es))`);
      }
    }

    // Delete the partner
    await sb.from("partners").delete().eq("id", p.id);
    console.log(`  ✓ deleted partner ${p.company}`);
  }

  console.log("\nDone.");
}

run().catch((e) => { console.error(e); process.exit(1); });
