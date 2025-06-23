"use client";

import { useState, useEffect, Suspense, lazy } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiRequest } from "../../../lib/api";
import { getToken } from "../../../lib/auth";

// Lazy load components for performance
const KanbanBoard = lazy(() => import("../../../components/KanbanBoard"));
const AnalyticsChart = lazy(() => import("../../../components/AnalyticsChart"));

export default function Project() {
  const [project, setProject] = useState(null);
  const [error, setError] = useState("");
  const router = useRouter();
  const { id } = useParams();

  useEffect(() => {
    const fetchProject = async () => {
      const token = getToken();
      if (!token) {
        router.push("/login");
        return;
      }

      try {
        const data = await apiRequest(`/projects/${id}`, "GET", null, token);
        setProject(data);
      } catch (err) {
        if (err.message.includes("Unauthorized") || err.message.includes("Invalid token")) {
          router.push("/login");
        } else if (err.message.includes("Not found")) {
          setError("Project not found");
        } else {
          setError("Failed to load project");
          console.error("Error fetching project:", err);
        }
      }
    };

    if (id) fetchProject();
  }, [id, router]);

  const handleExport = async () => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const data = await apiRequest(`/projects/${id}/export`, "GET", null, token);
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `project-${id}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error exporting project:", err);
      setError("Failed to export project");
    }
  };

  if (error) {
    return (
      <div className="p-4 max-w-7xl mx-auto">
        <p className="text-destructive">{error}</p>
        <Button onClick={() => router.push("/dashboard")} className="mt-4">
          Back to Dashboard
        </Button>
      </div>
    );
  }

  if (!project) {
    return <div className="p-4 max-w-7xl mx-auto">Loading...</div>;
  }

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{project.name}</h1>
        <div className="space-x-2">
          <Button asChild>
            <a href={`/projects/${id}/settings`}>Settings</a>
          </Button>
          <Button onClick={handleExport}>Export</Button>
        </div>
      </div>
      <Suspense fallback={<div>Loading components...</div>}>
        <KanbanBoard projectId={id} />
        <AnalyticsChart projectId={id} />
      </Suspense>
    </div>
  );
}