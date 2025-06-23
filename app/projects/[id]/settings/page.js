"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import InviteForm from "../../../../components/InviteForm";
import { apiRequest } from "../../../../lib/api";
import { getToken } from "../../../../lib/auth";

export default function ProjectSettings({ params }) {
  const [project, setProject] = useState(null);
  const router = useRouter();
  const { id } = params;

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const data = await apiRequest(`/projects/${id}`, "GET", null, getToken());
        setProject(data);
      } catch (error) {
        console.error("Error fetching project:", error);
        if (error.message.includes("Unauthorized")) {
          router.push("/login");
        }
      }
    };
    if (id) fetchProject();
  }, [id, router]);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this project?")) return;
    try {
      await apiRequest(`/projects/${id}`, "DELETE", null, getToken());
      router.push("/dashboard");
    } catch (error) {
      console.error("Error deleting project:", error);
    }
  };

  if (!project) return <div className="p-4">Loading...</div>;

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{project.name} Settings</h1>
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-2">Invite Members</h2>
          <InviteForm projectId={id} />
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-2">Danger Zone</h2>
          <Button variant="destructive" onClick={handleDelete}>
            Delete Project
          </Button>
        </div>
      </div>
    </div>
  );
}