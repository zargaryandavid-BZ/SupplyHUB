import { TopBar } from "@/components/TopBar";

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopBar />
      {children}
    </>
  );
}
