import { GroupView } from "@/components/GroupView";

// Exported as g.html; the API serves it for every /g/{id} URL and the page reads the id client-side.
export default function GroupPage() {
  return <GroupView />;
}
