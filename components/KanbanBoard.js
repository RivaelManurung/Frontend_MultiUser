import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import TaskCard from "./TaskCard";
import socket from "../lib/socket";
import { apiRequest } from "../lib/api";
import { getToken } from "../lib/auth";

const KanbanBoard = ({ projectId }) => {
  const [tasks, setTasks] = useState({ todo: [], "in-progress": [], done: [] });

  useEffect(() => {
    fetchTasks();

    socket.emit("joinProject", projectId);

    socket.on("taskCreated", (task) => {
      setTasks((prev) => ({
        ...prev,
        [task.status]: [...prev[task.status], task],
      }));
    });

    socket.on("taskUpdated", (task) => {
      setTasks((prev) => {
        const newTasks = { ...prev };
        Object.keys(newTasks).forEach((status) => {
          newTasks[status] = newTasks[status].filter((t) => t.id !== task.id);
        });
        newTasks[task.status].push(task);
        return newTasks;
      });
    });

    socket.on("taskDeleted", (taskId) => {
      setTasks((prev) => {
        const newTasks = { ...prev };
        Object.keys(newTasks).forEach((status) => {
          newTasks[status] = newTasks[status].filter((t) => t.id !== taskId);
        });
        return newTasks;
      });
    });

    return () => {
      socket.off("taskCreated");
      socket.off("taskUpdated");
      socket.off("taskDeleted");
    };
  }, [projectId]);

  const fetchTasks = async () => {
    try {
      const data = await apiRequest(`/tasks/${projectId}`, "GET", null, getToken());
      const groupedTasks = { todo: [], "in-progress": [], done: [] };
      data.forEach((task) => groupedTasks[task.status].push(task));
      setTasks(groupedTasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    }
  };

  const onDragEnd = async (result) => {
    const { source, destination } = result;
    if (!destination) return;

    const task = tasks[source.droppableId][source.index];
    const newTasks = { ...tasks };
    newTasks[source.droppableId].splice(source.index, 1);
    newTasks[destination.droppableId].splice(destination.index, 0, task);

    setTasks(newTasks);

    try {
      await apiRequest(`/tasks/${projectId}/${task.id}`, "PUT", { ...task, status: destination.droppableId }, getToken());
    } catch (error) {
      console.error("Error updating task:", error);
      fetchTasks(); // Revert on error
    }
  };

  return (
    <div className="flex space-x-4 p-4">
      <DragDropContext onDragEnd={onDragEnd}>
        {Object.keys(tasks).map((status) => (
          <Droppable droppableId={status} key={status}>
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="w-1/3 p-4 bg-gray-100 rounded-lg shadow"
              >
                <h3 className="text-lg font-semibold mb-2 capitalize">{status}</h3>
                {tasks[status].map((task, index) => (
                  <Draggable key={task.id} draggableId={task.id} index={index}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                      >
                        <TaskCard task={task} projectId={projectId} />
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        ))}
      </DragDropContext>
    </div>
  );
};

export default KanbanBoard;