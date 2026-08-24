import { redirect } from "next/navigation";
import { getActor } from "@/lib/session";
import { allPartnerContacts, allPartners } from "@/lib/data";
import { savePartnerContact, deletePartnerContact } from "@/app/actions";
import { Sidebar } from "@/components/Sidebar";
import { ContactsView } from "@/components/ContactsView";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const actor = await getActor();
  if (actor.role !== "manager") redirect("/");

  const [contacts, partners] = await Promise.all([
    allPartnerContacts(),
    allPartners(),
  ]);

  const partnerOptions = partners
    .filter((p) => p.active === 1)
    .sort((a, b) => a.company.localeCompare(b.company))
    .map((p) => ({ id: p.id, company: p.company }));

  return (
    <div className="app">
      <Sidebar active="contacts" />
      <main className="main" style={{ paddingTop: 20, paddingBottom: 40 }}>
        <div className="page-head" style={{ marginBottom: 14 }}>
          <div>
            <h1 style={{ fontSize: 22 }}>Partner Contacts</h1>
            <p>All contacts across your vendor network, in one place.</p>
          </div>
        </div>

        <ContactsView
          contacts={contacts}
          partnerOptions={partnerOptions}
          saveContact={savePartnerContact}
          deleteContact={deletePartnerContact}
        />
      </main>
    </div>
  );
}
