"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove } from "@dnd-kit/sortable";
import { apiRequest } from "../lib/api";
import { getToken } from "../lib/auth";
import { io } from "socket.io-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const KanbanBoard = ({ projectId = "" }) => {
  const [tasks, setTasks] = useState({ todo: [], in_progress: [], done: [] });
  const [members, setMembers] = useState([]);
  const [newTask, setNewTask] = useState({ title: "", description: "", assigneeId: "" });
  const [error, setError] = useState("");
  const { id } = useParams();

  useEffect(() => {
    const socket = io("http://localhost:5000", {
      query: { projectId: id },
    });

    const fetchData = async () => {
      try {
        setError("");
        const [taskData, memberData] = await Promise.all([
          apiRequest(`/projects/${projectId}/tasks`, "GET", null, getToken()),
          apiRequest(`/projects/${projectId}/members`, "GET", null, getToken()),
        ]);
        const groupedTasks = { todo: [], in_progress: [], done: [] };
        taskData.forEach((task) => groupedTasks[task.status]?.push(task));
        setTasks(groupedTasks);
        setMembers(memberData.members);
      } catch (error) {
        console.error("Error fetching data:", error);
        if (error.message.includes("Too many requests")) {
          setError("Rate limit exceeded. Please wait and try again.");
        } else {
          setError("Failed to load tasks or members.");
        }
      }
    };

    if (projectId) {
      // Debounce fetch to prevent rapid calls
      const timer = setTimeout(() => fetchData(), 500);
      return () => clearTimeout(timer);
    }

    socket.on(`project:${projectId}:taskCreated`, (task) => {
      setTasks((prev) => ({
        ...prev,
        [task.status]: [...prev[task.status], task],
      }));
    });

    socket.on(`project:${projectId}:taskUpdated`, (task) => {
      setTasks((prev) => {
        const newTasks = { ...prev };
        Object.keys(newTasks).forEach((status) => {
          newTasks[status] = newTasks[status].filter((t) => t.id !== task.id);
        });
        newTasks[task.status].push(task);
        return newTasks;
      });
    });

    socket.on(`project:${projectId}:taskDeleted`, (taskId) => {
      setTasks((prev) => {
        const newTasks = { ...prev };
        Object.keys(newTasks).forEach((status) => {
          newTasks[status] = newTasks[status].filter((t) => t.id !== taskId);
        });
        return newTasks;
      });
    });

    return () => {
      socket.off(`project:${projectId}:taskCreated`);
      socket.off(`project:${projectId}:taskUpdated`);
      socket.off(`project:${projectId}:taskDeleted`);
      socket.disconnect();
    };
  }, [projectId]);

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const sourceStatus = Object.keys(tasks).find((status) =>
      tasks[status].some((task) => task.id === active.id)
    );
    const destStatus = Object.keys(tasks).find((status) =>
      tasks[status].some((task) => task.id === over.id)
    );

    if (!sourceStatus || !destStatus) return;

    const sourceTasks = [...tasks[sourceStatus]];
    const destTasks = [...tasks[destStatus]];
    const task = sourceTasks.find((t) => t.id === active.id);
    const sourceIndex = sourceTasks.findIndex((t) => t.id === active.id);
    const destIndex = destTasks.findIndex((t) => t.id === over.id);

    sourceTasks.splice(sourceIndex, 1);
    destTasks.splice(destIndex, 0, { ...task, status: destStatus });

    const newTasks = {
      ...tasks,
      [sourceStatus]: sourceTasks,
      [destStatus]: destTasks,
    };

    setTasks(newTasks);

    try {
      await apiRequest(`/tasks/${active.id}`, "PATCH", { status: destStatus }, getToken());
    } catch (error) {
      console.error("Error updating task:", error);
      setError("Failed to update task.");
      fetchData(); // Revert on error
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      setError("");
      const taskData = {
        ...newTask,
        projectId,
        status: "todo",
      };
      await apiRequest(`/tasks`, "POST", taskData, getToken());
      setNewTask({ title: "", description: "", assigneeId: "" });
    } catch (error) {
      console.error("Error creating task:", error);
      setError("Failed to create task.");
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    try {
      setError("");
      await apiRequest(`/tasks/${taskId}`, "DELETE", null, getToken());
    } catch (error) {
      console.error("Error deleting task:", error);
      setError("Failed to delete task.");
    }
  };

  return (
    <div className="p-4">
      {error && <p className="text-destructive mb-4">{error}</p>}
      <h2 className="text-lg font-semibold mb-4">Create New Task</h2>
      <form onSubmit={handleCreateTask} className="mb-6 space-y-4">
        <Input
          type="text"
          value={newTask.title}
          onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
          placeholder="Task title"
          required
        />
        <Textarea
          value={newTask.description}
          onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
          placeholder="Task description"
        />
        <select
          value={newTask.assigneeId}
          onChange={(e) => setNewTask({ ...newTask, assigneeId: e.target.value })}
          className="p-2 border rounded"
        >
          <option value="">No assignee</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.email}
            </option>
          ))}
        </select>
        <Button type="submit">Create Task</Button>
      </form>
      <div className="flex space-x-4">
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          {Object.keys(tasks).map((status) => (
            <SortableContext key={status} items={tasks[status].map((task) => task.id)}>
              <div className="w-1/3 p-4 bg-gray-100 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-2 capitalize">
                  {status.replace("_", " ")}
                </h3>
                {tasks[status].map((task) => (
                  <SortableTask
                    key={task.id}
                    task={task}
                    members={members}
                    onDelete={() => handleDeleteTask(task.id)}
                  />
                ))}
              </div>
            </SortableContext>
          ))}
        </DndContext>
      </div>
    </div>
  );
};

const SortableTask = ({ task, members, onDelete }) => {
  const { attributes, listeners, setNodeRef } = useSortable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="p-4 bg-card rounded-lg mb-2 shadow flex justify-between items-center"
    >
      <div>
        <h3 className="font-medium">{task.title}</h3>
        {task.description && (
          <p className="text-sm text-muted-foreground">{task.description}</p>
        )}
        {task.assigneeId && (
          <p className="text-sm text-muted-foreground">
            Assigned to: {members.find((m) => m.id === task.assigneeId)?.email || "Unknown"}
          </p>
        )}
      </div>
      <Button variant="destructive" size="sm" onClick={onDelete}>
        Delete
      </Button>
    </div>
  );
};

export default KanbanBoard;