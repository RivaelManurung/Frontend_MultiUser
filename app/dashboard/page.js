"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "../../lib/api";
import { getToken, removeToken } from "../../lib/auth";

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [newProjectName, setNewProjectName] = useState("");
  const router = useRouter();

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const data = await apiRequest("/projects", "GET", null, getToken());
        setProjects(data);
      } catch (error) {
        if (error.message.includes("Unauthorized")) {
          removeToken();
          router.push("/login");
        } else {
          console.error("Error fetching projects:", error);
        }
      }
    };
    fetchProjects();
  }, [router]);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    try {
      const project = await apiRequest(
        "/projects",
        "POST",
        { name: newProjectName },
        getToken()
      );
      setProjects([...projects, project]);
      setNewProjectName("");
    } catch (error) {
      console.error("Error creating project:", error);
    }
  };

  const handleLogout = () => {
    removeToken();
    router.push("/login");
  };

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Button variant="destructive" onClick={handleLogout}>
          Logout
        </Button>
      </div>

      <form onSubmit={handleCreateProject} className="mb-6">
        <div className="flex space-x-2">
          <div className="flex-1">
            <Label htmlFor="project-name">New Project</Label>
            <Input
              id="project-name"
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Project name"
              required
            />
          </div>
          <Button type="submit" className="mt-6">
            Create Project
          </Button>
        </div>
      </form>

      <h2 className="text-xl font-semibold mb-4">Your Projects</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {projects.map((project) => (
          <a
            key={project.id}
            href={`/projects/${project.id}`}
            className="p-4 bg-gray-100 rounded-lg shadow hover:bg-gray-200 transition"
          >
            <h3 className="text-lg font-semibold">{project.name}</h3>
            <p className="text-sm text-gray-600">
              Owner: {project.ownerId === getToken()?.id ? "You" : "Other"}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}
