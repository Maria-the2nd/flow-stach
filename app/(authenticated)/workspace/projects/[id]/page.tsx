
import { ProjectDetailsView } from "@/components/workspace/project-details-view";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <ProjectDetailsView id={id} />;
}
