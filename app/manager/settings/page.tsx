import { redirect } from "next/navigation";
import { getActor } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { saveSettings, saveEmployee, deleteEmployee } from "@/app/actions";
import { allEmployees } from "@/lib/data";
import { publicLogoUrl } from "@/lib/storage";
import { Sidebar } from "@/components/Sidebar";
import { SettingsForm } from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { saved?: string; tab?: string };
}) {
  const actor = await getActor();
  if (actor.role !== "manager") redirect("/");

  const [settings, employees] = await Promise.all([
    getSettings(),
    allEmployees(),
  ]);
  const logoUrl = publicLogoUrl(settings.logo_path);

  return (
    <div className="app">
      <Sidebar active="settings" />
      <main className="main" style={{ paddingTop: 20, paddingBottom: 40 }}>
        <div className="page-head" style={{ marginBottom: 14 }}>
          <div>
            <h1 style={{ fontSize: 22 }}>Settings</h1>
            <p>Your company profile, financial details, and the contact info your partners see.</p>
          </div>
        </div>

        {searchParams.saved === "1" && (
          <div className="notice" style={{ marginBottom: 14 }}>Settings saved successfully.</div>
        )}

        <SettingsForm
          settings={settings}
          logoUrl={logoUrl}
          action={saveSettings}
          employees={employees}
          saveEmployee={saveEmployee}
          deleteEmployee={deleteEmployee}
          activeTab={searchParams.tab}
        />
      </main>
    </div>
  );
}
