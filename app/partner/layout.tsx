import { TopBar } from "@/components/TopBar";

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopBar />
      {children}
    </>
  );
}
