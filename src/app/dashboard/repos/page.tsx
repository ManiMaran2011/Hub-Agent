import { ReposPanel } from "@/components/dashboard/ReposPanel";

export default function ReposPage({
  searchParams,
}: {
  searchParams: { connected?: string; error?: string; pending?: string };
}) {
  return (
    <div>
      {searchParams.connected && (
        <Banner tone="success">Repository connected. Open an issue on it to see it show up on Activity.</Banner>
      )}
      {searchParams.pending && (
        <Banner tone="info">Installation requested — waiting on organization owner approval.</Banner>
      )}
      {searchParams.error && (
        <Banner tone="fail">Something went wrong connecting that repository. Please try again.</Banner>
      )}
      <ReposPanel />
    </div>
  );
}

function Banner({ tone, children }: { tone: "success" | "info" | "fail"; children: React.ReactNode }) {
  const toneClass = {
    success: "border-signal-success/30 bg-signal-success-dim/40 text-signal-success",
    info: "border-signal-info/30 bg-signal-info-dim/40 text-signal-info",
    fail: "border-signal-fail/30 bg-signal-fail-dim/40 text-signal-fail",
  }[tone];

  return <div className={`mb-6 rounded-md border px-4 py-2.5 text-sm ${toneClass}`}>{children}</div>;
}
