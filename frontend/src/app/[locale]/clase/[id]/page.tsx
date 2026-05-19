import { ClassDetailClient } from "./class-detail-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ClassDetailPage({ params }: Props) {
  const { id } = await params;
  return <ClassDetailClient classId={id} />;
}
