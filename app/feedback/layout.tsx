import { TopBar } from "@/components/TopBar";

export default function FeedbackLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopBar />
      {children}
    </>
  );
}
