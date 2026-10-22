import ProfileEditor from "../../components/ProfileEditor";
import SecurityPanel from "../../components/settings/SecurityPanel";
import { PageHeader } from "../../components/admin/bits";

export default function Profile() {
  return (
    <>
      <PageHeader title="My profile" subtitle="Your photo, details and password." />
      <ProfileEditor />
      <h2 className="section-title mt-16">Security</h2>
      <SecurityPanel />
    </>
  );
}
