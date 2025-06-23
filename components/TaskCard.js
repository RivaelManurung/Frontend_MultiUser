import { Button } from "@/components/ui/button";
import { apiRequest } from "../lib/api";
import { getToken } from "../lib/auth";

const TaskCard = ({ task, projectId }) => {
  const handleDelete = async () => {
    try {
      await apiRequest(`/tasks/${projectId}/${task.id}`, "DELETE", null, getToken());
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  return (
    <div className="p-4 mb-2 bg-white rounded-lg shadow">
      <h4 className="font-semibold">{task.title}</h4>
      <p className="text-sm text-gray-600">{task.description || "No description"}</p>
      <Button
        variant="destructive"
        size="sm"
        onClick={handleDelete}
        className="mt-2"
      >
        Delete
      </Button>
    </div>
  );
};

export default TaskCard;