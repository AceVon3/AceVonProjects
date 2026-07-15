import { SignUp } from "@clerk/nextjs";
import AuthShell from "@/components/AuthShell";

export const metadata = { title: "Create your account — AgencyMan.ai" };

export default function SignUpPage() {
  return (
    <AuthShell>
      <SignUp />
    </AuthShell>
  );
}
