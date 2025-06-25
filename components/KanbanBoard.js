"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { DndContext, closestCorners, DragOverlay, useSensor, PointerSensor } from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { apiRequest } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { io } from "socket.io-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, GripVertical } from "lucide-react";

const KanbanBoard = ({ projectId = "" }) => {
  const [tasks, setTasks] = useState({ todo: [], in_progress: [], done: [] });
  const [members, setMembers] = useState([]);
  const [newTask, setNewTask] = useState({ title: "", description: "", assigneeId: "" });
  const [error, setError] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [deletingTaskId, setDeletingTaskId] = useState(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { id } = useParams();

  const pointerSensor = useSensor(PointerSensor);

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
        setError(error.message.includes("Too many requests")
          ? "Rate limit exceeded. Please wait and try again."
          : "Failed to load tasks or members.");
      }
    };

    if (projectId) {
      const timer = setTimeout(() => fetchData(), 500);
      return () => clearTimeout(timer);
    }

    socket.on(`project:${projectId}:taskCreated`, (task) => {
      console.log("Socket: taskCreated", task);
      setTasks((prev) => {
        if (prev[task.status].some((t) => t.id === task.id)) return prev;
        return {
          ...prev,
          [task.status]: [...prev[task.status], task],
        };
      });
    });

    socket.on(`project:${projectId}:taskUpdated`, (task) => {
      console.log("Socket: taskUpdated", task);
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
      console.log("Socket: taskDeleted", taskId);
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

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
    console.log("Drag started:", event.active.id);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) {
      console.log("Drag ended: No over target");
      return;
    }

    const activeId = active.id;
    const overId = over.id;
    console.log("Drag ended:", { activeId, overId });

    const sourceColumn = Object.keys(tasks).find((status) =>
      tasks[status].some((task) => task.id === activeId)
    );
    if (!sourceColumn) {
      console.log("Source column not found for task:", activeId);
      return;
    }

    let destColumn;
    if (["todo", "in_progress", "done"].includes(overId)) {
      destColumn = overId;
    } else {
      destColumn = Object.keys(tasks).find((status) =>
        tasks[status].some((task) => task.id === overId)
      );
    }
    if (!destColumn) {
      console.log("Destination column not found for overId:", overId);
      return;
    }

    console.log("Moving task from", sourceColumn, "to", destColumn);

    if (sourceColumn === destColumn) {
      const items = tasks[sourceColumn];
      const oldIndex = items.findIndex((item) => item.id === activeId);
      const newIndex = items.findIndex((item) => item.id === overId);
      if (oldIndex !== newIndex && newIndex !== -1) {
        const newItems = arrayMove(items, oldIndex, newIndex);
        setTasks((prev) => ({
          ...prev,
          [sourceColumn]: newItems,
        }));
        console.log("Reordered within", sourceColumn);
      }
      return;
    }

    const task = tasks[sourceColumn].find((t) => t.id === activeId);
    if (!task) {
      console.log("Task not found:", activeId);
      return;
    }

    const newTasks = { ...tasks };
    newTasks[sourceColumn] = newTasks[sourceColumn].filter((t) => t.id !== activeId);
    const updatedTask = { ...task, status: destColumn };

    // Handle drop into empty or non-empty column
    if (overId === destColumn) {
      newTasks[destColumn] = [...newTasks[destColumn], updatedTask];
    } else {
      const targetIndex = newTasks[destColumn].findIndex((t) => t.id === overId);
      newTasks[destColumn].splice(targetIndex, 0, updatedTask);
    }

    setTasks(newTasks);

    try {
      await apiRequest(`/tasks/${activeId}`, "PATCH", { status: destColumn }, getToken());
      console.log("Task status updated:", { taskId: activeId, status: destColumn });
    } catch (error) {
      console.error("Error updating task:", error);
      setError("Failed to update task status.");
      setTasks(tasks); // Revert on error
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
        assigneeId: newTask.assigneeId === "none" ? null : newTask.assigneeId,
      };
      const response = await apiRequest(`/tasks`, "POST", taskData, getToken());
      console.log("Task created:", response);
      setTasks((prev) => ({
        ...prev,
        todo: [...prev.todo, response],
      }));
      setNewTask({ title: "", description: "", assigneeId: "" });
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error("Error creating task:", error);
      setError("Failed to create task.");
    }
  };

  const handleDeleteTask = async (taskId) => {
    setDeletingTaskId(taskId);
    try {
      setError("");
      await apiRequest(`/tasks/${taskId}`, "DELETE", null, getToken());
      console.log("Task deleted:", taskId);
      setTasks((prev) => {
        const newTasks = { ...prev };
        Object.keys(newTasks).forEach((status) => {
          newTasks[status] = newTasks[status].filter((t) => t.id !== taskId);
        });
        return newTasks;
      });
      setDeletingTaskId(null);
    } catch (error) {
      console.error("Error deleting task:", error);
      setError("Failed to delete task.");
      setDeletingTaskId(null);
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    const sourceColumn = Object.keys(tasks).find((status) =>
      tasks[status].some((task) => task.id === taskId)
    );
    if (!sourceColumn || sourceColumn === newStatus) return;

    const task = tasks[sourceColumn].find((t) => t.id === taskId);
    if (!task) return;

    const newTasks = { ...tasks };
    newTasks[sourceColumn] = newTasks[sourceColumn].filter((t) => t.id !== taskId);
    newTasks[newStatus] = [...newTasks[newStatus], { ...task, status: newStatus }];

    setTasks(newTasks);

    try {
      await apiRequest(`/tasks/${taskId}`, "PATCH", { status: newStatus }, getToken());
      console.log("Status changed:", { taskId, newStatus });
    } catch (error) {
      console.error("Error updating task status:", error);
      setError("Failed to update task status.");
      setTasks(tasks);
    }
  };

  const exportToJson = () => {
    const dataStr = JSON.stringify(tasks, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `project_${projectId}_tasks.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getActiveTask = () => {
    if (!activeId) return null;
    for (const status of Object.keys(tasks)) {
      const task = tasks[status].find((t) => t.id === activeId);
      if (task) return task;
    }
    return null;
  };

  return (
    <div className="p-4">
      {error && <p className="text-destructive mb-4">{error}</p>}

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold">Kanban Board</h2>
        <Button onClick={() => setIsCreateDialogOpen(true)}>Create Task</Button>
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTask} className="space-y-4">
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
            <Select
              value={newTask.assigneeId}
              onValueChange={(value) => setNewTask({ ...newTask, assigneeId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No assignee</SelectItem>
                {members.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Button onClick={exportToJson} className="mb-6">
        Export to JSON
      </Button>

      <DndContext
        sensors={[pointerSensor]}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.keys(tasks).map((status) => (
            <DroppableColumn
              key={status}
              id={status}
              title={status.replace("_", " ")}
              tasks={tasks[status]}
              members={members}
              onDelete={handleDeleteTask}
              onStatusChange={handleStatusChange}
              deletingTaskId={deletingTaskId}
            />
          ))}
        </div>
        <DragOverlay>
          {activeId ? (
            <TaskCard
              task={getActiveTask()}
              members={members}
              isDragging
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

const DroppableColumn = ({ id, title, tasks, members, onDelete, onStatusChange, deletingTaskId }) => {
  return (
    <div className="bg-gray-50 rounded-lg p-4 min-h-[300px]">
      <h3 className="text-lg font-semibold mb-4 capitalize text-center">
        {title} ({tasks.length})
      </h3>
      <SortableContext
        items={tasks.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >
        <div id={id} className="space-y-2 min-h-[250px]">
          {tasks.map((task) => (
            <SortableTask
              key={task.id}
              task={task}
              members={members}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
              isDeleting={deletingTaskId === task.id}
            />
          ))}
          {tasks.length === 0 && (
            <div className="text-gray-400 text-center py-8 text-sm min-h-[250px] flex items-center justify-center">
              Drop tasks here
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
};

const SortableTask = ({ task, members, onDelete, onStatusChange, isDeleting }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
    >
      <TaskCard
        task={task}
        members={members}
        onDelete={onDelete}
        onStatusChange={onStatusChange}
        isDeleting={isDeleting}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
};

const TaskCard = ({ task, members, onDelete, onStatusChange, isDeleting, dragHandleProps, isDragging = false }) => {
  if (!task) return null;

  return (
    <div className={`p-3 ${isDragging ? 'rotate-3 shadow-lg' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <div
              {...dragHandleProps}
              className="cursor-grab active:cursor-grabbing mt-1 text-gray-400 hover:text-gray-600"
            >
              <GripVertical size={16} />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-sm text-gray-900 mb-1">
                {task.title}
              </h4>
              {task.description && (
                <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                  {task.description}
                </p>
              )}
              {task.assigneeId && (
                <p className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block mb-2">
                  {members.find((m) => m.id === task.assigneeId)?.email || "Unknown"}
                </p>
              )}
              <Select
                value={task.status}
                onValueChange={(value) => onStatusChange(task.id, value)}
              >
                <SelectTrigger className="w-[120px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">Todo</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 h-auto"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Trash2 size={14} />
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Task</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{task.title}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDelete(task.id)}
                className="bg-red-500 hover:bg-red-600"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default KanbanBoard;