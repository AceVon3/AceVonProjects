import ProfileForm from "@/components/ProfileForm";
import TopBar from "@/components/TopBar";

export const metadata = { title: "Agent Profile · AgencyMan.ai" };

export default function SetupPage(): React.JSX.Element {
  return (
    <main className="min-h-screen bg-canvas">
      <TopBar title="Profile" />
      <div className="max-w-[680px] mx-auto px-4 md:px-0 py-[30px]">
        <header className="mb-5">
          <h1 className="text-17 font-[650] m-0 text-ink">Agent profile</h1>
          <p className="text-13 mt-1 m-0 text-ink-2">
            Update your agency details to keep your intelligence and compliance
            feeds relevant.
          </p>
        </header>
        <ProfileForm />
      </div>
    </main>
  );
}
