import ProfileForm from "@/components/ProfileForm";

export const metadata = { title: "Agency Profile · Agent Intelligence" };

export default function SetupPage(): React.JSX.Element {
  return (
    <main className="min-h-screen" style={{ background: "#fafaf9" }}>
      <div className="max-w-[1100px] mx-auto px-4 py-10">
        <header className="mb-5">
          <h1 className="text-[18px] font-medium m-0" style={{ color: "#1c1c1b" }}>
            Agency Profile
          </h1>
          <p className="text-[13px] mt-1 m-0" style={{ color: "#5F5E5A" }}>
            Update your agency details to keep your intelligence and (soon)
            compliance feeds relevant.
          </p>
        </header>
        <ProfileForm />
      </div>
    </main>
  );
}
